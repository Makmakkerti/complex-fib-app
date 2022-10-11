const keys = require('./keys');

// Express setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');

const pgClient = new Pool({
	user: keys.pgUser,
	host: keys.pgHost,
	database: keys.pgDatabase,
	password: keys.pgPassword,
	port: keys.pgPort,
});

pgClient.on('error', () => console.log('Lost PG conection'));

pgClient.on('connect', (client) => {
	client
		.query('CREATE TABLE IF NOT EXISTS values (number INT)')
		.catch((err) => console.error(err));
});

// Redis Client Setup
const redis = require('redis');

const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express Routes

app.get('/', (_req, res) => {
	res.send('Hi');
});

app.get('/values/all', async (req, res) => {
	const values = await pgClient.query('SELECT * FROM values');
	res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
	redisClient.hgetall('values', (err, values) => {
		res.send(values);
	});
});

app.post('/values', async (req, res) => {
	const { index } = req.body;
	if (parseInt(index) > 40) {
		return res.status(422).send('Index should be less then 40');
	}

	redisClient.hset('values', index, 'Nothing yet!');
	redisPublisher.publish('insert', index);
	pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

	res.send({ working: true });
});

const port = process.env.PORT || 5000;
app.listen(port, (err) => {
	console.log('Server running on ' + port);
});
