const crypto = require("crypto");


function base64url(value) {

    return Buffer
        .from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

}


function createAdminToken() {

    const secret =
        process.env.VERIFICATION_ADMIN_SECRET;


    if (!secret) {

        throw new Error(
            "VERIFICATION_ADMIN_SECRET is missing"
        );

    }


    const now =
        Math.floor(
            Date.now() / 1000
        );


    const payload = {

        role: "verification_admin",

        iat: now,

        exp: now + 7200,

        nonce:
            crypto.randomBytes(16)
                .toString("hex")

    };


    const encodedPayload =
        base64url(
            JSON.stringify(payload)
        );


    const signature =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(encodedPayload)
            .digest("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");


    return (
        encodedPayload +
        "." +
        signature
    );

}


function verifyAdminToken(token) {

    const secret =
        process.env.VERIFICATION_ADMIN_SECRET;


    if (!secret || !token) {
        return false;
    }


    const parts =
        token.split(".");


    if (parts.length !== 2) {
        return false;
    }


    const payloadPart =
        parts[0];

    const signaturePart =
        parts[1];


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(payloadPart)
            .digest("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");


    if (
        signaturePart.length !==
        expectedSignature.length
    ) {
        return false;
    }


    const valid =
        crypto.timingSafeEqual(
            Buffer.from(signaturePart),
            Buffer.from(expectedSignature)
        );


    if (!valid) {
        return false;
    }


    try {

        const payload =
            JSON.parse(
                Buffer.from(
                    payloadPart,
                    "base64url"
                ).toString("utf8")
            );


        if (
            payload.role !==
            "verification_admin"
        ) {
            return false;
        }


        if (
            typeof payload.exp !== "number" ||
            payload.exp <
            Math.floor(Date.now() / 1000)
        ) {
            return false;
        }


        return true;

    } catch (error) {

        return false;

    }

}


function requireAdmin(req, res) {

    const authorization =
        req.headers.authorization || "";


    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {

        res.status(401).json({
            error:
                "Admin authentication required."
        });

        return false;
    }


    const token =
        authorization.substring(7).trim();


    if (
        !verifyAdminToken(token)
    ) {

        res.status(401).json({
            error:
                "Invalid or expired admin token."
        });

        return false;
    }


    return true;

}


module.exports = {

    createAdminToken,

    verifyAdminToken,

    requireAdmin

};
