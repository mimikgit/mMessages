import Router from 'router';
import Action from 'action-js';
import queryString from 'query-string';
import ApiError from './helper/api-error';
import extractToken from './helper/authorization-helper';
import { toJson, mapJsonToItem } from './helper/json-helper';

const app = Router({ mergeParams: true });

// Initialize mimik serverless api
mimikModule.exports = (context, req, res) => {
  req.mimikContext = context;
  res.writeError = (apiError) => {
    res.statusCode = apiError.code;
    const json = JSON.stringify({
      code: apiError.code,
      message: apiError.message,
    });
    res.end(json);
  };

  app(req, res, (e) => {
    const err = (e && new ApiError(400, e.message)) ||
      new ApiError(404, 'not found');
    res.writeError(err);
  });
};

// GET all messages with no query, or ?after=<UUID> to get messages after a specific message
app.get('/messages', (req, res) => {
  const query = queryString.parse(req._parsedUrl.query);
  const id = (query && query.after) || null;
  let list = id ? 0 : [];

  req.mimikContext.storage.eachItem((key, value) => {
    const item = JSON.parse(value);
    if (item.id === id) {
      list = [];
    } else if (list !== 0) {
      list.push(item);
    }
  });

  const json = toJson({
    data: (list === 0) ? [] : list,
  });

  res.end(json);
});

// GET specific message with ID of the message
app.get('/messages/:itemId', (req, res) => {
  const { itemId } = req.params;
  const { storage } = req.mimikContext;
  const item = storage.getItem(itemId);

  if (!item) {
    res.writeError(new ApiError(400, `no such item: ${itemId}`));
    return;
  }

  res.end(item);
});

// POST new JSON messages
app.post('/messages', (req, res) => {
  if (!req.body) {
    res.writeError(new ApiError('missing JSON body'));
    return;
  }

  new Action((cb) => {
    const item = mapJsonToItem(req.body);
    if (!item) {
      cb(new Error('invalid item'));
    } else {
      item.createTime = new Date(Date.now()).toISOString();
      cb(item);
    }
  })
    .next((item) => {
      const json = JSON.stringify(item);
      req.mimikContext.storage.setItem(item.id, json);
      return item;
    })
    .next((item) => {
      const json = toJson(item);
      res.end(json);
    })
    .guard((e) => {
      res.writeError(new ApiError(400, e.message));
    })
    .go();
});

// DELETE a specific message with ID of the message
app.delete('/messages/:itemId', (req, res) => {
  const { itemId } = req.params;
  const { storage } = req.mimikContext;
  const item = storage.getItem(itemId);

  if (!item) {
    res.writeError(new ApiError(400, `no such item: ${itemId}`));
    return;
  }

  storage.removeItem(itemId);
  res.end(item);
});

// GET all the devices on the local network
app.get('/devices', (req, res) => {
  const accessToken = extractToken(req.authorization);
  const edgeUrl = 'http://localhost:8083/mds/v1';
  const context = req.mimikContext;

  context.http.request(({
    url: `${edgeUrl}/nodes?clusters=linkLocal`,
    success: (r) => {
      const nodes = JSON.parse(r.data);
      const encryptedJson = JSON.stringify(nodes.data);
      context.edge.decryptEncryptedNodesJson({
        type: 'local',
        data: encryptedJson,
        token: accessToken,
        success: (result) => { res.end(result.data); },
        error: (err) => { res.end(err.message); },
      });
    },
    error: (err) => {
      res.end(err.message);
    },
  }));
});
