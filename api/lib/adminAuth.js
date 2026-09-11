const crypto = require("crypto");

const TOKEN_LIFETIME =
    2 * 60 * 60 * 1000; // 2 hours


function getSecret() {

    const secret =
        process.env.VERIFICATION_ADMIN_SECRET;

    if (!secret) {

        throw new Error(
            "VERIFICATION_ADMIN_SECRET is not configured."
        );
    }

    return secret;
}


/* =========================================================
   BASE64URL
========================================================= */

function base64url(value) {

    return Buffer
        .from(value)
        .toString("base64url");
}


/* =========================================================
   CREATE SIGNATURE
========================================================= */

function createSignature(payload) {

    return crypto
        .createHmac(
            "sha256",
            getSecret()
        )
        .update(payload)
        .digest("base64url");
}


/* =========================================================
   CREATE ADMIN TOKEN
========================================================= */

function createAdminToken() {

    const payload = {

        role:
            "verification_admin",

        exp:
            Date.now() +
            TOKEN_LIFETIME

    };


    const encoded =
        base64url(
            JSON.stringify(payload)
        );


    const signature =
        createSignature(
            encoded
        );


    return (
        encoded +
        "." +
        signature
    );
}


/* =========================================================
   SAFE COMPARE
========================================================= */

function safeCompare(
    value1,
    value2
) {

    const a =
        Buffer.from(
            String(value1)
        );

    const b =
        Buffer.from(
            String(value2)
        );


    if (
        a.length !==
        b.length
    ) {

        return false;
    }


    return crypto.timingSafeEqual(
        a,
        b
    );
}


/* =========================================================
   VERIFY ADMIN TOKEN
========================================================= */

function verifyAdminToken(
    token
) {

    try {

        if (!token) {

            return false;
        }


        const parts =
            token.split(".");


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
            createSignature(
                encoded
            );


        if (
            !safeCompare(
                signature,
                expected
            )
        ) {

            return false;
        }


        const payload =
            JSON.parse(
                Buffer
                    .from(
                        encoded,
                        "base64url"
                    )
                    .toString("utf8")
            );


        if (
            payload.role !==
            "verification_admin"
        ) {

            return false;
        }


        if (
            !payload.exp ||
            Date.now() >
            payload.exp
        ) {

            return false;
        }


        return true;

    } catch (error) {

        return false;
    }
}


/* =========================================================
   LOGIN PASSWORD
========================================================= */

function verifyAdminPassword(
    password
) {

    const adminPassword =
        process.env
            .VERIFICATION_ADMIN_PASSWORD;


    if (
        !adminPassword ||
        !password
    ) {

        return false;
    }


    return safeCompare(
        password,
        adminPassword
    );
}


/* =========================================================
   AUTHORIZATION HEADER
========================================================= */

function getBearerToken(
    req
) {

    const header =
        req.headers.authorization ||
        "";


    if (
        !header.startsWith(
            "Bearer "
        )
    ) {

        return null;
    }


    return header
        .slice(7)
        .trim();
}


/* =========================================================
   REQUIRE ADMIN
========================================================= */

function requireAdmin(
    req,
    res
) {

    const token =
        getBearerToken(req);


    if (
        !verifyAdminToken(
            token
        )
    ) {

        res
            .status(401)
            .json({
                success:false,
                error:
                    "Unauthorized"
            });

        return false;
    }


    return true;
}


module.exports = {

    createAdminToken,

    verifyAdminToken,

    verifyAdminPassword,

    getBearerToken,

    requireAdmin

};
