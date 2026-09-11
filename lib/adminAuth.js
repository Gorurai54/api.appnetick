const crypto =
    require("crypto");


const SECRET =
    process.env.VERIFICATION_ADMIN_SECRET;


const TOKEN_LIFETIME =
    2 * 60 * 60 * 1000;


/* =========================================================
   SIGN
========================================================= */

function sign(value) {

    return crypto
        .createHmac(
            "sha256",
            SECRET
        )
        .update(value)
        .digest("hex");

}


/* =========================================================
   CREATE TOKEN
========================================================= */

function createAdminToken() {

    if (!SECRET) {

        throw new Error(
            "VERIFICATION_ADMIN_SECRET is not configured."
        );

    }


    const payload = {

        role:
            "verification_admin",

        exp:
            Date.now() +
            TOKEN_LIFETIME

    };


    const encoded =
        Buffer
            .from(
                JSON.stringify(payload)
            )
            .toString(
                "base64url"
            );


    const signature =
        sign(encoded);


    return (
        encoded +
        "." +
        signature
    );

}


/* =========================================================
   VERIFY TOKEN
========================================================= */

function verifyAdminToken(token) {

    if (!SECRET) {
        return false;
    }


    if (!token) {
        return false;
    }


    const parts =
        String(token).split(".");


    if (
        parts.length !== 2
    ) {

        return false;

    }


    const encoded =
        parts[0];

    const signature =
        parts[1];


    const expected =
        sign(encoded);


    const a =
        Buffer.from(
            signature
        );

    const b =
        Buffer.from(
            expected
        );


    if (
        a.length !== b.length
    ) {

        return false;

    }


    if (
        !crypto.timingSafeEqual(
            a,
            b
        )
    ) {

        return false;

    }


    try {

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


        if (
            payload.role !==
            "verification_admin"
        ) {

            return false;

        }


        if (
            Number(payload.exp) <
            Date.now()
        ) {

            return false;

        }


        return payload;

    } catch(error) {

        return false;

    }

}


/* =========================================================
   REQUIRE ADMIN
========================================================= */

function requireAdmin(req) {

    const authorization =
        req.headers.authorization ||
        "";


    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {

        throw new Error(
            "Missing admin authorization token."
        );

    }


    const token =
        authorization
            .substring(7)
            .trim();


    if (!token) {

        throw new Error(
            "Missing admin authorization token."
        );

    }


    const payload =
        verifyAdminToken(
            token
        );


    if (!payload) {

        throw new Error(
            "Invalid or expired admin token."
        );

    }


    return payload;

}


module.exports = {

    createAdminToken,

    verifyAdminToken,

    requireAdmin

};
