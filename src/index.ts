import 'dotenv/config';
import { ApplicationCommandPermissionType, Client, Events, GatewayIntentBits, Guild, GuildTextBasedChannel, TextBasedChannel, TextChannel } from "discord.js";
import { Collection, MongoClient } from 'mongodb';
import type { Message as Message_t } from './types.js';

const token = process.env.DISCORD_TOKEN;
const uri = process.env.MONGODB_URI;
const serverId = process.env.SERVER_ID
if (token == null || uri == null || serverId == null)
    throw new Error('Undefined Discord token, mongodb uri or Discord server; check your .env file');

const dbClient = new MongoClient(uri);
const discord = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

discord.login(token);

discord.once(Events.ClientReady, async discord => {
    console.log(`The scraper is ready! Logged in as ${discord.user.tag}`);

    await dbClient.connect();
    const db = dbClient.db('basedcount_scrape').collection<Message_t>('messages');

    const guild = discord.guilds.cache.get(serverId);
    if (!guild) throw new Error(`Can't find guild with ID ${serverId}`);

    const channels = [...guild.channels.cache.values()].filter(ch => ch.isTextBased() || ch.isThread()) as GuildTextBasedChannel[];

    for (const channel of channels) {
        console.log(`Now scraping: #${channel.name}`);
        const found = await saveMessagesBefore(db, channel, '9223372036854775807', 0);
        console.log(`${found} messages\n`);
    }
});

async function saveMessagesBefore(db: Collection<Message_t>, channel: GuildTextBasedChannel, lastID: string, size: number): Promise<number> {
    const messageMap = await channel.messages.fetch({ limit: 100, before: lastID });    //The 100 messages limit comes from the Discord API
    if (messageMap.size === 0) return size;

    const messageArr: Message_t[] = [...messageMap.values()].map(message => ({
        author_display_name: message.author.displayName,
        author_id: message.author.id,
        author_username: message.author.username,
        channel_id: message.channelId,
        channel_name: channel.name,
        content: message.content,
        message_id: message.id,
        timestamp: new Date(message.createdTimestamp),
    }));

    await db.bulkWrite(messageArr.map(message => ({ insertOne: { document: message } })));
    console.log(`Scraped until ${messageArr[0].timestamp.toLocaleString()}`);

    return saveMessagesBefore(db, channel, messageArr[messageArr.length - 1].message_id, messageArr.length + size);
}
