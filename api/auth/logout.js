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
        req.method !== "POST"
    ){

        return res.status(405).json({

            success:false,

            error:
                "Method not allowed"

        });

    }


    try{

        /*
         * Validate the current token.
         *
         * The browser will remove the token
         * immediately as well.
         */

        requireUser(
            req
        );


        return res.status(200).json({

            success:true,

            message:
                "Logged out successfully."

        });


    }catch(error){

        /*
         * Logout should remain successful
         * even if the local token has already
         * expired.
         */

        return res.status(200).json({

            success:true,

            message:
                "Logged out."

        });

    }

};
