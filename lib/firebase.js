const admin = require("firebase-admin");

const config = JSON.parse(process.env.FIREBASE_CONFIG_JSON);

function createApp(name, cfg) {

    const existing = admin.apps.find(
        app => app.name === name
    );

    if (existing) {
        return existing;
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: cfg.projectId,
            clientEmail: cfg.clientEmail,
            privateKey: cfg.privateKey.replace(/\\n/g, "\n")
        }),
        databaseURL: cfg.databaseURL
    }, name);
}

const postsApp = createApp(
    "PostsApp",
    config.posts
);

const notificationsApp = createApp(
    "NotificationsApp",
    config.notifications
);

const dataApp = createApp(
    "DataApp",
    config.data
);

module.exports = {
    postsDB: postsApp.database(),
    notificationsDB: notificationsApp.database(),
    dataDB: dataApp.database()
};
