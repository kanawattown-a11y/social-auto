const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1';
    }

    /**
     * Generate content suggestions using OpenAI
     */
    async generateContentSuggestions(prompt, options = {}) {
        try {
            const {
                platform = 'general',
                tone = 'professional',
                length = 'medium',
                count = 3,
            } = options;

            const systemPrompt = this.buildSystemPrompt(platform, tone, length);

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                    n: count,
                    temperature: 0.8,
                    max_tokens: 500,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.choices.map(choice => choice.message.content.trim());
        } catch (error) {
            logger.error('AI content generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate content suggestions');
        }
    }

    /**
     * Generate hashtag suggestions
     */
    async generateHashtags(content, options = {}) {
        try {
            const { count = 10, platform = 'instagram' } = options;

            const prompt = `Generate ${count} relevant and trending hashtags for this ${platform} post. Return only hashtags separated by spaces, no explanations:\n\n"${content}"`;

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a social media expert. Generate relevant, trending hashtags. Return only hashtags with # symbol, separated by spaces.',
                        },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 200,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const hashtags = response.data.choices[0].message.content
                .trim()
                .split(/\s+/)
                .filter(tag => tag.startsWith('#'))
                .slice(0, count);

            return hashtags;
        } catch (error) {
            logger.error('Hashtag generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate hashtags');
        }
    }

    /**
     * Generate auto-reply template
     */
    async generateReplyTemplate(context, options = {}) {
        try {
            const { tone = 'friendly', language = 'ar' } = options;

            const prompt = `Create a professional auto-reply message template for: "${context}". 
      Tone: ${tone}
      Language: ${language === 'ar' ? 'Arabic' : 'English'}
      Include placeholders like {name}, {product}, {date} where appropriate.`;

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a customer service expert. Create professional, friendly auto-reply templates with placeholders.',
                        },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 300,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            logger.error('Reply template generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate reply template');
        }
    }

    /**
     * Analyze sentiment of text
     */
    async analyzeSentiment(text) {
        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'Analyze the sentiment of the following text. Respond with only one word: positive, negative, or neutral.',
                        },
                        { role: 'user', content: text },
                    ],
                    temperature: 0.3,
                    max_tokens: 10,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            logger.error('Sentiment analysis error:', error.response?.data || error.message);
            return 'neutral';
        }
    }

    /**
     * Build system prompt based on platform and options
     */
    buildSystemPrompt(platform, tone, length) {
        const lengthGuide = {
            short: '50-100 characters',
            medium: '100-200 characters',
            long: '200-500 characters',
        };

        const platformGuides = {
            whatsapp: 'WhatsApp messages should be conversational and direct',
            telegram: 'Telegram posts can be more detailed with formatting',
            instagram: 'Instagram captions should be engaging with emojis',
            facebook: 'Facebook posts should encourage interaction',
            general: 'Create engaging social media content',
        };

        return `You are a professional social media content creator. 
    Platform: ${platform}
    Tone: ${tone}
    Length: ${lengthGuide[length] || lengthGuide.medium}
    
    ${platformGuides[platform] || platformGuides.general}
    
    Create compelling, ${tone} content that drives engagement. Use appropriate emojis and formatting.`;
    }
}

module.exports = new AIService();
