export interface Message {
    message_id: string,
    author_id: string,
    author_username: string,
    author_display_name: string,
    content: string,
    timestamp: Date,
    channel_id: string,
    channel_name: string,
}

//NOTE: message_id, author_id, channel_id should be saved as numbers on the database but are too big for JS