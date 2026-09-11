const ALLOWED_ORIGIN =
    "https://appnetick-link.vercel.app";

function cors(req, res) {

    const origin =
        req.headers.origin;

    if (origin === ALLOWED_ORIGIN) {

        res.setHeader(
            "Access-Control-Allow-Origin",
            ALLOWED_ORIGIN
        );

    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader(
        "Vary",
        "Origin"
    );

    if (req.method === "OPTIONS") {

        res.status(204).end();

        return true;
    }

    return false;
}

module.exports = cors;
