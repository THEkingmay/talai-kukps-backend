require('dotenv').config();
const mqtt = require('mqtt');

const url = process.env.MQTT_URL;
console.log("Connecting to:", url);

const client = mqtt.connect(url, {
    username: process.env.MQTT_SERVER_USERNAME,
    password: process.env.MQTT_SERVER_PASSWORD,
    clientId: `test-${Math.random().toString(16).slice(2, 10)}`,
    rejectUnauthorized: true
});

client.on('connect', () => {
    console.log('Connected!');
    client.end();
});

client.on('error', (err) => {
    console.error('Error:', err);
    client.end();
});
