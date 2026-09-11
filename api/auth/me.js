const {
    usersDB
} = require("../../lib/firebase");

const cors =
    require("../../lib/cors");

const {
    requireUser
} = require("../../lib/userAuth");


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
        req.method !== "GET"
    ){

        return res.status(405).json({

            success:false,

            error:
                "Method not allowed"

        });

    }


    try{

        const session =
            requireUser(
                req
            );


        const uid =
            session.uid;


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

            return res.status(401).json({

                success:false,

                error:
                    "Account no longer exists."

            });

        }


        const data =
            snapshot.val() || {};


        /*
         * Never return password or PIN.
         */

        const user = {

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


        return res.status(200).json({

            success:true,

            uid:uid,

            user:user

        });


    }catch(error){

        console.error(
            "AUTH ME ERROR:",
            error
        );


        return res.status(401).json({

            success:false,

            error:
                error.message ||
                "Invalid login session."

        });

    }

};
