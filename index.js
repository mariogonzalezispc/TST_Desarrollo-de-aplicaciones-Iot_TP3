const host = "brokergrupo6.ddns.net";
const port = "1883";
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const OPTIONS = {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: " ",
    password: " ",
    reconnectPeriod: 1000
};

const connectUrl = `mqtt://${host}:${port}`;
//const connectUrl = 'mqtt://brokergrupo6.ddns.net:1883';
const chatGPTReqTopic = "chatgpt/request/+";
const client = mqtt.connect(connectUrl, OPTIONS);

// Add your OpenAI API key to your environment variables in .env
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let messages = []; // Store conversation history
const maxMessageCount = 10;
const http = axios.create({
    baseURL: "https://api.openai.com/v1/chat",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
});

const genText = async (userId) => {
    try {
        const { data } = await http.post("/completions", {
            model: "gpt-3.5-turbo",
            messages: messages[userId],
            temperature: 0.7,
        });
        if (data.choices && data.choices.length > 0) {
            const { content } = data.choices[0].message;
            messages[userId].push({ role: "assistant", content: content });
            if (messages[userId].length > maxMessageCount) {
                messages[userId].shift(); // Remove the oldest message
            }
            const replyTopic = `chatgpt/response/${userId}`;
            client.publish(replyTopic, content, { qos: 0, retain: false }, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        }
    } catch (e) {
        console.log(e);
    }
};

client.on("message", (topic, payload) => {
    // Check if the topic is not the one you're publishing to
    if (topic.startsWith(chatGPTReqTopicPrefix)) {
        const userId = topic.replace(chatGPTReqTopicPrefix, "");
        messages[userId] = messages[userId] || [];
        messages[userId].push({ role: "user", content: payload.toString() });
        if (messages[userId].length > maxMessageCount) {
            messages[userId].shift(); // Remove the oldest message
        }
        genText(userId);
    }
});