const express = require('express');
const uuid = require('uuid/v4');
const bodyParser = require('body-parser');

const expressServer = express();
expressServer.use(bodyParser());
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
    return res.json({ status: 'ok' });
});

expressServer.get('/status', (req, res) => {
    const tokens = [];
    currentAccessTokens.forEach((c, key) => tokens.push({
        client_id: key,
        authToken: c.authToken,
        accessToken: c.accessToken,
        expires: c.expires,
    }));

    return res.json({ tokens, clients: clientDb })
});

const getClient = (client_id) => {
    return clientDb.find((c) => c.client_id === client_id);
}

expressServer.post('/token', (req, res) => {
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

    if (!grant_type || grant_type !== 'authorization_code') {
        return res.status(401).json({ error: 'Invalid grant type' });
    }

    const client = getClient(client_id);
    if (
        !client // no client by that Id
        || !client.redirect_uris.find((r) => r.uri === redirect_uri) // redirect_uri match
        || !currentAccessTokens.has(client_id)
        || currentAccessTokens.get(client_id).authToken !== code
    ) {
        return res.status(401).json({ error: 'No pending token exchange for this client.'});
    }

    // let's make you an acesss token, and clear the authToken
    const clientToken = currentAccessTokens.get(client_id);
    clientToken.accessToken = 'i am an access token';
    clientToken.authToken = null;
    currentAccessTokens.set(client_id, clientToken);

    return res.json({
        access_token: clientToken.accessToken,
        expires_in: 3600,
    });
});

expressServer.get('/auth', (req, res) => {
    const { response_type, client_id, redirect_uri, scope, state } = req.query;

    const client = getClient(client_id);

    if (!client || !client.redirect_uris.find((r) => r.uri === redirect_uri)) {
        return res.status(401).json({ error: 'Unauthorized. No such client or redirect Uri mismatch', client });
    }

    // token
    let accessToken;

    if (!currentAccessTokens.has(client_id)) {
        accessToken = {
            authToken: uuid(),
            accessToken: null,
            expires: new Date().getTime() + (3600 * 1000)
        };

        currentAccessTokens.set(client_id, accessToken);
    } else {
        // is expired?
        accessToken = currentAccessTokens.get(client_id);
        if (accessToken.expires < new Date().getTime()) {
            return res.status(401).json({ error: 'Token expired.'});
        }

        // is exchanged
        if (!accessToken.authToken) {
            return res.status(401).json({ error: 'Token already exchanged.' });
        }
    }

    return res.json({
        client: (client ? client.name : 'no such client'),
        action: `We will redirect to ${ redirect_uri }?code=${ accessToken.authToken }&state=${ encodeURIComponent(state) }`,
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
