const express = require('express');
const uuid = require('uuid/v4');

const expressServer = express();
expressServer.use(express.json());

const currentAccessTokens = new Map();

const clientDb = [
    {
        name: 'Hot Dang Interactive',
        client_id: 'abc123',
        redirect_uris: [
            {
                name: 'Main',
                uri: 'http://localhost:3001/login',
            },
        ],
        valid_scopes: ['accounts', 'payments'],
    },
    {
        name: 'Four and a Half Giraffes, Ltd',
        client_id: '123abc',
        redirect_uris: [
            {
                name: 'Giraffe',
                uri: 'http://localhost:3002/login',
            },
        ],
        valid_scopes: ['accounts', 'payments'],
    }
];

expressServer.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

expressServer.get('/status', (req, res) => {
    const tokens = [];
    currentAccessTokens.forEach((c, key) => tokens.push({ client_id: key, token: c.accessToken, expires: c.expires }));

    res.json({ tokens, clients: clientDb })
})

const getClient = (client_id) => {
    return clientDb.find((c) => c.client_id === client_id);
}

expressServer.get('/auth', (req, res) => {
    const { response_type, client_id, redirect_uri, scope, state } = req.query;

    const client = getClient(client_id);

    if (!client || !client.redirect_uris.find((r) => r.uri === redirect_uri)) {
        return res.status(401).json({ error: 'Unauthorized. No such client or redirect Uri mismatch', client });
    }

    // token
    let accessToken;

    if (!currentAccessTokens.has(client_id)) {
        accessToken = { accessToken: uuid(), expires: new Date().getTime() + (3600 * 1000)}
        currentAccessTokens.set(client_id, accessToken);
    } else {
        // is expired?
        accessToken = currentAccessTokens.get(client_id);
        if (accessToken.expires < new Date().getTime()) {
            res.status(401).json({ error: 'Token expired.'});
        }
    }

    res.json({
        client: (client ? client.name : 'no such client'),
        accessToken,
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
    });
});

expressServer.listen(3002, () => {
    console.log('Listening to requests on :3002');
});
