const crypto = require("crypto");

const {
    usersDB
} = require("../lib/firebase");

const cors =
    require("../lib/cors");

const {
    createUserToken,
    createPinToken
} = require("../lib/userAuth");


function hashPassword(password) {

    const hash =
        crypto.createHash(
            "sha256"
        );


    hash.update(
        password +
        "APPNETICK_SECURE",
        "utf8"
    );


    return hash.digest("hex");

}


function safeUser(uid, data) {

    return {

        uid: uid,

        Username:
            data.Username ||
            data.username ||
            "",

        username:
            data.Username ||
            data.username ||
            "",

        email:
            data.email ||
            "",

        full_name:
            data.full_name ||
            "",

        avatar:
            data.avatar ||
            "",

        JoinedDate:
            data.JoinedDate ||
            0

    };

}


module.exports = async function handler(
    req,
    res
) {

    if(
        cors(req,res)
    ){
        return;
    }


    if(
        req.method !== "POST"
    ){

        return res.status(405).json({

            success:false,

            error:
                "Method not allowed"

        });

    }


    try{

        const body =
            req.body || {};


        const username =
            typeof body.username ===
            "string"
                ? body.username.trim()
                : "";


        const password =
            typeof body.password ===
            "string"
                ? body.password
                : "";


        if(!username){

            return res.status(400).json({

                success:false,

                error:
                    "Username is required."

            });

        }


        if(!password){

            return res.status(400).json({

                success:false,

                error:
                    "Password is required."

            });

        }


        /*
        =========================================
        USERNAME INDEX
        =========================================
        */

        const indexSnapshot =
            await usersDB
                .ref(
                    "UsernameIndex/" +
                    username
                )
                .once("value");


        let uid =
            indexSnapshot.val();


        /*
         * Support index object format too.
         */

        if(
            uid &&
            typeof uid === "object"
        ){

            uid =
                uid.uid ||
                uid.UID ||
                uid.id ||
                "";

        }


        if(!uid){

            return res.status(401).json({

                success:false,

                error:
                    "Username or password is incorrect."

            });

        }


        /*
        =========================================
        USERS/{uid}
        =========================================
        */

        const userSnapshot =
            await usersDB
                .ref(
                    "Users/" +
                    uid
                )
                .once("value");


        if(
            !userSnapshot.exists()
        ){

            return res.status(401).json({

                success:false,

                error:
                    "Username or password is incorrect."

            });

        }


        const user =
            userSnapshot.val() || {};


        /*
        =========================================
        HASH PASSWORD
        =========================================
        */

        const hashedPassword =
            hashPassword(
                password
            );


        const storedPassword =
            String(
                user.password ||
                ""
            );


        /*
        =========================================
        SAFE COMPARISON
        =========================================
        */

        const a =
            Buffer.from(
                hashedPassword,
                "utf8"
            );

        const b =
            Buffer.from(
                storedPassword,
                "utf8"
            );


        let passwordMatch =
            false;


        if(
            a.length ===
            b.length
        ){

            passwordMatch =
                crypto.timingSafeEqual(
                    a,
                    b
                );

        }


        if(!passwordMatch){

            return res.status(401).json({

                success:false,

                error:
                    "Username or password is incorrect."

            });

        }


        /*
        =========================================
        SAFE USER
        =========================================
        */

        const publicUser =
            safeUser(
                uid,
                user
            );


        /*
        =========================================
        PIN CHECK
        =========================================
        */

        const storedPin =
            user.pin;


        const hasPin =
            storedPin !==
            undefined &&
            storedPin !==
            null &&
            String(
                storedPin
            ).trim() !== "";


        if(hasPin){

            const pinToken =
                createPinToken(
                    uid
                );


            return res.status(200).json({

                success:true,

                requiresPin:true,

                uid:uid,

                pinToken:
                    pinToken,

                user:
                    publicUser

            });

        }


        /*
        =========================================
        NO PIN
        =========================================
        */

        const token =
            createUserToken(
                uid
            );


        return res.status(200).json({

            success:true,

            requiresPin:false,

            token:token,

            uid:uid,

            user:
                publicUser

        });


    }catch(error){

        console.error(
            "LOGIN ERROR:",
            error
        );


        return res.status(500).json({

            success:false,

            error:
                "Unable to login right now.",

            details:
                error.message || ""

        });

    }

};
