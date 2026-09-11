const {
    usersDB,
    dataDB
} = require("../../lib/firebase");

const cors =
    require("../../lib/cors");


module.exports = async function handler(
    req,
    res
) {

    if (
        cors(req, res)
    ) {
        return;
    }


    if (
        req.method !== "POST"
    ) {

        return res
            .status(405)
            .json({
                error:
                    "Method not allowed"
            });

    }


    try {

        const body =
            req.body || {};


        let username =
            String(
                body.username || ""
            )
            .trim()
            .replace(/^@+/, "")
            .toLowerCase();


        if (!username) {

            return res
                .status(400)
                .json({
                    error:
                        "Username is required."
                });

        }


        /*
         * UID client से blindly trust नहीं करेंगे.
         *
         * Username से actual account फिर से
         * server side verify करेंगे.
         */

        const snapshot =
            await usersDB
                .ref("Users")
                .once("value");


        let actualUser = null;


        snapshot.forEach(
            child => {

                if (actualUser) {
                    return;
                }


                const value =
                    child.val() || {};


                const storedUsername =
                    String(
                        value.Username || ""
                    )
                    .trim()
                    .replace(/^@+/, "")
                    .toLowerCase();


                if (
                    storedUsername ===
                    username
                ) {

                    actualUser = {

                        uid:
                            value.uid ||
                            child.key,

                        username:
                            value.Username ||
                            username,

                        full_name:
                            value.full_name ||
                            "",

                        email:
                            value.email ||
                            "",

                        avatar:
                            value.avatar ||
                            ""

                    };

                }

            }
        );


        if (!actualUser) {

            return res
                .status(404)
                .json({
                    error:
                        "Username not found."
                });

        }


        /*
         * Existing verification request.
         */

        const existingSnapshot =
            await dataDB
                .ref(
                    `VerificationRequests/${actualUser.uid}`
                )
                .once("value");


        if (
            existingSnapshot.exists()
        ) {

            const existing =
                existingSnapshot.val() || {};


            if (
                existing.verification_status
                === "approved"
            ) {

                return res
                    .status(409)
                    .json({

                        code:
                            "ALREADY_VERIFIED",

                        error:
                            "This account is already verified."

                    });

            }


            if (
                existing.verification_status
                === "pending"
            ) {

                return res
                    .status(409)
                    .json({

                        code:
                            "ALREADY_PENDING",

                        error:
                            "A verification application is already under review."

                    });

            }

        }


        /*
         * Only allowed verification fields.
         *
         * Password / PIN intentionally excluded.
         */

        const verificationData = {

            uid:
                actualUser.uid,

            username:
                actualUser.username,

            full_name:
                actualUser.full_name,

            legal_name:
                String(
                    body.legal_name || ""
                ).trim(),

            email:
                actualUser.email,

            date_of_birth:
                String(
                    body.date_of_birth || ""
                ).trim(),

            country:
                String(
                    body.country || ""
                ).trim(),

            phone:
                String(
                    body.phone || ""
                ).trim(),

            account_category:
                String(
                    body.account_category || ""
                ).trim(),

            profession:
                String(
                    body.profession || ""
                ).trim(),

            verification_reason:
                String(
                    body.verification_reason || ""
                ).trim(),

            known_for:
                String(
                    body.known_for || ""
                ).trim(),

            website:
                String(
                    body.website || ""
                ).trim(),

            social_profile:
                String(
                    body.social_profile || ""
                ).trim(),

            audience:
                String(
                    body.audience || ""
                ).trim(),

            content_category:
                String(
                    body.content_category || ""
                ).trim(),

            achievement:
                String(
                    body.achievement || ""
                ).trim(),

            public_presence:
                String(
                    body.public_presence || ""
                ).trim(),

            authenticity_confirmed:
                body.authenticity_confirmed === true,

            information_confirmed:
                body.information_confirmed === true,

            terms_confirmed:
                body.terms_confirmed === true,

            verification_status:
                "pending",

            submitted_at:
                Date.now(),

            reviewed_at:
                0,

            reviewed_by:
                ""

        };


        /*
         * Required confirmation.
         */

        if (
            !verificationData.authenticity_confirmed ||
            !verificationData.information_confirmed ||
            !verificationData.terms_confirmed
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "All confirmations are required."
                });

        }


        /*
         * Actual save:
         *
         * DataApp
         *   VerificationRequests
         *       UID
         */

        await dataDB
            .ref(
                `VerificationRequests/${actualUser.uid}`
            )
            .set(
                verificationData
            );


        return res
            .status(200)
            .json({

                success:true,

                uid:
                    actualUser.uid,

                username:
                    actualUser.username,

                verification_status:
                    "pending"

            });


    } catch(error) {

        console.error(
            "verification submit:",
            error
        );


        return res
            .status(500)
            .json({
                error:
                    "Unable to submit verification application."
            });

    }

};
