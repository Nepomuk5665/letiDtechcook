const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

async function getYouTubeLink(recipeTitle) {
    const searchQuery = encodeURIComponent(`how to cook ${recipeTitle}`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&key=${process.env.YOUTUBE_API_KEY}&type=video&maxResults=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching YouTube video:', error);
        return null;
    }
}

app.post('/api/generate-recipe', async (req, res) => {
    const { prompt, image, time, specifications } = req.body;
  
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o", 
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: image,
                                },
                            },
                        ],
                    }
                ],
                max_tokens: 300
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('OpenAI API error response:', errorBody);
            throw new Error(`OpenAI API request failed: ${response.statusText}. Details: ${errorBody}`);
        }

        const data = await response.json();

        // Extract recipe title from the generated content
        const recipeTitle = data.choices[0].message.content.split('\n')[0].replace(/\*\*/g, '').trim();

        // Fetch YouTube link
        const youtubeLink = await getYouTubeLink(recipeTitle);

        // Add YouTube link to the response
        data.youtubeLink = youtubeLink;

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});