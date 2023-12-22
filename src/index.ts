import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { MongoClient } from 'mongodb';
import type { Message as Message_t } from './types.js';

const token = process.env.DISCORD_TOKEN;
const uri = process.env.MONGODB_URI;
if (token == null || uri == null)
    throw new Error('Undefined discord token or mongodb uri, check your .env file');

const dbClient = new MongoClient(uri);
const discord = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

//Do once, when the bot is ready to operate
discord.once(Events.ClientReady, readyClient => {
    console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`);
});


discord.login(token);
await dbClient.connect();
const db = dbClient.db('basedcount_scrape').collection<Message_t>('messages');

async function saveMessagesBefore(channel: TextChannel, lastID: string, size: number): Promise<number> {
    const messageMap = await channel.messages.fetch({ limit: 100, before: lastID });    //The 100 messages limit comes from the Discord API
    if (messageMap.size === 0) return size;

    const messageArr: Message_t[] = [...messageMap.values()].map(message => ({
        author_display_name: message.author.displayName,
        author_id: message.author.id,
        author_username: message.author.username,
        channel_id: message.channelId,
        channel_name: message.channel.name,
        content: message.content,
        message_id: message.id,
        timestamp: new Date(message.createdTimestamp),
    }));

    await db.bulkWrite(messageArr.map(message => ({ insertOne: { document: message } })));

    return saveMessagesBefore(channel, messageArr[0].message_id, messageArr.length + size);
}
