const crypto =
    require("crypto");


const SECRET =
    process.env.APPNETICK_AUTH_SECRET;


const USER_TOKEN_LIFETIME =
    30 * 24 * 60 * 60 * 1000;


const PIN_TOKEN_LIFETIME =
    5 * 60 * 1000;


function requireSecret(){

    if(!SECRET){

        throw new Error(
            "APPNETICK_AUTH_SECRET is not configured."
        );

    }

}


function sign(
    value
){

    requireSecret();


    return crypto
        .createHmac(
            "sha256",
            SECRET
        )
        .update(value)
        .digest("hex");

}


/* =========================================================
   CREATE USER TOKEN
========================================================= */

function createUserToken(
    uid
){

    const payload = {

        type:
            "user",

        uid:
            uid,

        exp:
            Date.now() +
            USER_TOKEN_LIFETIME

    };


    const encoded =
        Buffer
            .from(
                JSON.stringify(
                    payload
                )
            )
            .toString(
                "base64url"
            );


    const signature =
        sign(
            encoded
        );


    return (
        encoded +
        "." +
        signature
    );

}


/* =========================================================
   CREATE PIN TOKEN
========================================================= */

function createPinToken(
    uid
){

    const payload = {

        type:
            "pin",

        uid:
            uid,

        exp:
            Date.now() +
            PIN_TOKEN_LIFETIME

    };


    const encoded =
        Buffer
            .from(
                JSON.stringify(
                    payload
                )
            )
            .toString(
                "base64url"
            );


    const signature =
        sign(
            encoded
        );


    return (
        encoded +
        "." +
        signature
    );

}


/* =========================================================
   VERIFY TOKEN
========================================================= */

function verifyToken(
    token,
    expectedType
){

    try{

        if(!token){

            return null;

        }


        const parts =
            String(token).split(".");


        if(
            parts.length !== 2
        ){

            return null;

        }


        const encoded =
            parts[0];

        const signature =
            parts[1];


        const expected =
            sign(
                encoded
            );


        const a =
            Buffer.from(
                signature,
                "utf8"
            );

        const b =
            Buffer.from(
                expected,
                "utf8"
            );


        if(
            a.length !==
            b.length
        ){

            return null;

        }


        if(
            !crypto.timingSafeEqual(
                a,
                b
            )
        ){

            return null;

        }


        const payload =
            JSON.parse(
                Buffer
                    .from(
                        encoded,
                        "base64url"
                    )
                    .toString(
                        "utf8"
                    )
            );


        if(
            payload.type !==
            expectedType
        ){

            return null;

        }


        if(
            !payload.uid
        ){

            return null;

        }


        if(
            Number(payload.exp) <
            Date.now()
        ){

            return null;

        }


        return payload;

    }catch(error){

        return null;

    }

}


/* =========================================================
   REQUIRE USER
========================================================= */

function requireUser(
    req
){

    const authorization =
        req.headers.authorization ||
        "";


    if(
        !authorization.startsWith(
            "Bearer "
        )
    ){

        throw new Error(
            "Missing authentication token."
        );

    }


    const token =
        authorization
            .substring(7)
            .trim();


    const payload =
        verifyToken(
            token,
            "user"
        );


    if(!payload){

        throw new Error(
            "Invalid or expired login session."
        );

    }


    return payload;

}


/* =========================================================
   REQUIRE PIN TOKEN
========================================================= */

function requirePinToken(
    token
){

    const payload =
        verifyToken(
            token,
            "pin"
        );


    if(!payload){

        throw new Error(
            "PIN verification session expired."
        );

    }


    return payload;

}


module.exports = {

    createUserToken,

    createPinToken,

    verifyToken,

    requireUser,

    requirePinToken

};
