const crypto =
    require("crypto");

const {
    usersDB
} = require("../lib/firebase");

const cors =
    require("../lib/cors");

const {
    requirePinToken,
    createUserToken
} = require("../lib/userAuth");


function safeUser(
    uid,
    data
){

    return {

        uid:uid,

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


function safeCompare(
    first,
    second
){

    const a =
        Buffer.from(
            String(first),
            "utf8"
        );

    const b =
        Buffer.from(
            String(second),
            "utf8"
        );


    if(
        a.length !==
        b.length
    ){

        return false;

    }


    return crypto.timingSafeEqual(
        a,
        b
    );

}


module.exports =
async function handler(
    req,
    res
){

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


        const pinToken =
            typeof body.pinToken ===
            "string"
                ? body.pinToken.trim()
                : "";


        const pin =
            typeof body.pin ===
            "string"
                ? body.pin.trim()
                : "";


        if(!pinToken){

            return res.status(401).json({

                success:false,

                error:
                    "PIN verification session is missing."

            });

        }


        if(!pin){

            return res.status(400).json({

                success:false,

                error:
                    "PIN is required."

            });

        }


        /*
        =========================================
        VERIFY TEMP PIN TOKEN
        =========================================
        */

        let payload;


        try{

            payload =
                requirePinToken(
                    pinToken
                );

        }catch(error){

            return res.status(401).json({

                success:false,

                error:
                    error.message

            });

        }


        const uid =
            payload.uid;


        /*
        =========================================
        GET USER
        =========================================
        */

        const snapshot =
            await usersDB
                .ref(
                    "Users/" +
                    uid
                )
                .once("value");


        if(
            !snapshot.exists()
        ){

            return res.status(404).json({

                success:false,

                error:
                    "Account not found."

            });

        }


        const user =
            snapshot.val() || {};


        const storedPin =
            user.pin;


        if(
            storedPin ===
            undefined ||
            storedPin ===
            null ||
            String(
                storedPin
            ).trim() === ""
        ){

            return res.status(400).json({

                success:false,

                error:
                    "This account does not have a PIN."

            });

        }


        /*
        =========================================
        PIN CHECK
        =========================================
        */

        if(
            !safeCompare(
                pin,
                String(
                    storedPin
                )
            )
        ){

            return res.status(401).json({

                success:false,

                error:
                    "Incorrect PIN."

            });

        }


        /*
        =========================================
        CREATE PERSISTENT USER TOKEN
        =========================================
        */

        const token =
            createUserToken(
                uid
            );


        return res.status(200).json({

            success:true,

            token:

                token,

            uid:

                uid,

            user:

                safeUser(
                    uid,
                    user
                )

        });


    }catch(error){

        console.error(
            "PIN VERIFY ERROR:",
            error
        );


        return res.status(500).json({

            success:false,

            error:
                "Unable to verify PIN.",

            details:
                error.message || ""

        });

    }

};
