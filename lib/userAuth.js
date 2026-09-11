const crypto = require("crypto");

const SECRET =
    process.env.APPNETICK_AUTH_SECRET;


function base64UrlEncode(value) {

    return Buffer
        .from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}


function base64UrlDecode(value) {

    let str =
        String(value)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    while (str.length % 4 !== 0) {

        str += "=";

    }

    return Buffer
        .from(str, "base64")
        .toString("utf8");
}


function sign(value) {

    if (!SECRET) {

        throw new Error(
            "APPNETICK_AUTH_SECRET is not configured."
        );

    }

    return base64UrlEncode(
        crypto
            .createHmac(
                "sha256",
                SECRET
            )
            .update(value)
            .digest()
    );
}


function createToken(
    uid,
    expiresInSeconds =
        365 * 24 * 60 * 60
) {

    const now =
        Date.now();

    const payload = {

        uid:
            String(uid),

        type:
            "user",

        iat:
            now,

        exp:
            now +
            expiresInSeconds * 1000

    };


    const body =
        base64UrlEncode(
            JSON.stringify(
                payload
            )
        );


    const signature =
        sign(body);


    return (
        body +
        "." +
        signature
    );

}


function safeEqual(
    a,
    b
) {

    try {

        const bufferA =
            Buffer.from(
                String(a)
            );

        const bufferB =
            Buffer.from(
                String(b)
            );


        if (
            bufferA.length !==
            bufferB.length
        ) {

            return false;

        }


        return crypto
            .timingSafeEqual(
                bufferA,
                bufferB
            );

    } catch (error) {

        return false;

    }

}


function verifyToken(token) {

    if (!token || !SECRET) {

        return null;

    }


    const parts =
        String(token).split(".");


    if (parts.length !== 2) {

        return null;

    }


    const body =
        parts[0];

    const signature =
        parts[1];


    const expected =
        sign(body);


    if (
        !safeEqual(
            signature,
            expected
        )
    ) {

        return null;

    }


    try {

        const payload =
            JSON.parse(
                base64UrlDecode(
                    body
                )
            );


        if (
            !payload ||
            !payload.uid ||
            !payload.type
        ) {

            return null;

        }


        if (
            payload.type !==
            "user" &&
            payload.type !==
            "pin_pending"
        ) {

            return null;

        }


        if (
            !payload.exp ||
            Date.now() >
            Number(payload.exp)
        ) {

            return null;

        }


        return payload;

    } catch (error) {

        return null;

    }

}


function createPinToken(uid) {

    const now =
        Date.now();

    const payload = {

        uid:
            String(uid),

        type:
            "pin_pending",

        iat:
            now,

        exp:
            now +
            5 * 60 * 1000

    };


    const body =
        base64UrlEncode(
            JSON.stringify(
                payload
            )
        );


    return (
        body +
        "." +
        sign(body)
    );

}


function getBearerToken(req) {

    const header =
        req.headers.authorization ||
        "";


    if (
        !header
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return null;

    }


    return header
        .slice(7)
        .trim();

}


module.exports = {

    createToken,

    createPinToken,

    verifyToken,

    getBearerToken

};
