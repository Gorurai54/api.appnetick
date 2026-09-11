const crypto =
    require("crypto");

const cors =
    require("../lib/cors");

const {
    usersDB
} =
    require("../lib/firebase");

const {
    createToken,
    createPinToken
} =
    require("../lib/userAuth");


function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(
            String(password) +
            "APPNETICK_SECURE",
            "utf8"
        )
        .digest("hex");

}


function safeEqualHash(
    a,
    b
) {

    try {

        const A =
            Buffer.from(
                String(a),
                "utf8"
            );

        const B =
            Buffer.from(
                String(b),
                "utf8"
            );


        if (
            A.length !==
            B.length
        ) {

            return false;

        }


        return crypto
            .timingSafeEqual(
                A,
                B
            );

    } catch (error) {

        return false;

    }

}


function getSafeUser(
    uid,
    user,
    fallbackUsername
) {

    return {

        uid:
            String(
                user.uid ||
                uid
            ),

        Username:
            user.Username ||
            user.username ||
            fallbackUsername ||
            "",

        username:
            user.Username ||
            user.username ||
            fallbackUsername ||
            "",

        full_name:
            user.full_name ||
            user.fullName ||
            "",

        email:
            user.email ||
            "",

        avatar:
            user.avatar ||
            "",

        JoinedDate:
            user.JoinedDate ||
            user.joinedDate ||
            ""

    };

}


async function getUserByUsername(
    username
) {

    /*
     * Primary lookup:
     *
     * UsernameIndex/{username}
     */

    let indexSnapshot;


    try {

        indexSnapshot =
            await usersDB
                .ref(
                    "UsernameIndex/" +
                    username
                )
                .once("value");

    } catch (error) {

        console.error(
            "UsernameIndex error:",
            error
        );

        throw new Error(
            "Unable to access Users database."
        );

    }


    let uid = "";


    if (
        indexSnapshot.exists()
    ) {

        const indexValue =
            indexSnapshot.val();


        if (
            typeof indexValue ===
            "string"
        ) {

            uid =
                indexValue;

        } else if (
            indexValue &&
            typeof indexValue ===
            "object"
        ) {

            uid =
                indexValue.uid ||
                indexValue.UID ||
                "";

        }

    }


    /*
     * Fallback:
     * Search Users if UsernameIndex
     * is missing.
     */

    if (!uid) {

        try {

            const snapshot =
                await usersDB
                    .ref("Users")
                    .orderByChild(
                        "Username"
                    )
                    .equalTo(
                        username
                    )
                    .limitToFirst(1)
                    .once("value");


            if (
                snapshot.exists()
            ) {

                const data =
                    snapshot.val();

                const keys =
                    Object.keys(data);

                if (keys.length > 0) {

                    uid =
                        keys[0];

                }

            }

        } catch (error) {

            console.error(
                "Users fallback error:",
                error
            );

        }

    }


    if (!uid) {

        return null;

    }


    const userSnapshot =
        await usersDB
            .ref(
                "Users/" +
                uid
            )
            .once("value");


    if (
        !userSnapshot.exists()
    ) {

        return null;

    }


    return {

        uid,

        data:
            userSnapshot.val()

    };

}


module.exports =
    async function handler(
        req,
        res
    ) {

        if (
            cors(req, res)
        ) {

            return;

        }


        if (
            req.method !==
            "POST"
        ) {

            return res
                .status(405)
                .json({

                    success:
                        false,

                    error:
                        "Method not allowed."

                });

        }


        try {

            const body =
                typeof req.body ===
                "string"
                    ? JSON.parse(
                        req.body
                    )
                    : (
                        req.body || {}
                    );


            const username =
                String(
                    body.username ||
                    ""
                ).trim();


            const password =
                String(
                    body.password ||
                    ""
                );


            if (!username) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Username is required."

                    });

            }


            if (!password) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Password is required."

                    });

            }


            /*
             * Firebase paths cannot contain
             * these characters.
             */

            if (
                /[.#$[\]\/]/.test(
                    username
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Invalid username."

                    });

            }


            const found =
                await getUserByUsername(
                    username
                );


            if (!found) {

                return res
                    .status(401)
                    .json({

                        success:
                            false,

                        error:
                            "Username or password is incorrect."

                    });

            }


            const user =
                found.data;


            const storedPassword =
                user.password ||
                "";


            /*
             * EXACT Android algorithm:
             *
             * SHA-256(
             *     password +
             *     APPNETICK_SECURE
             * )
             */

            const suppliedHash =
                hashPassword(
                    password
                );


            if (
                !safeEqualHash(
                    suppliedHash,
                    storedPassword
                )
            ) {

                return res
                    .status(401)
                    .json({

                        success:
                            false,

                        error:
                            "Username or password is incorrect."

                    });

            }


            const safeUser =
                getSafeUser(
                    found.uid,
                    user,
                    username
                );


            /*
             * PIN check
             */

            const hasPin =
                user.pin !==
                    undefined &&
                user.pin !==
                    null &&
                String(
                    user.pin
                ).length > 0;


            if (hasPin) {

                const pinToken =
                    createPinToken(
                        found.uid
                    );


                return res
                    .status(200)
                    .json({

                        success:
                            true,

                        requiresPin:
                            true,

                        uid:
                            found.uid,

                        pinToken:

                            pinToken,

                        user:
                            safeUser

                    });

            }


            /*
             * No PIN
             */

            const token =
                createToken(
                    found.uid
                );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    requiresPin:
                        false,

                    token:
                        token,

                    uid:
                        found.uid,

                    user:
                        safeUser

                });


        } catch (error) {

            console.error(
                "LOGIN SERVER ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Unable to login right now.",

                    details:
                        process.env.NODE_ENV ===
                        "development"
                            ? error.message
                            : undefined

                });

        }

    };
