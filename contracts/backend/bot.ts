export class DiscordBot {
    static async sendMessage(channelId: string, content: string) {
        // Mock Discord API call
        return { id: Date.now().toString(), content };
    }
}