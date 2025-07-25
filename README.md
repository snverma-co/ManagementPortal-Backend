# Backend Deployment Guide

## MongoDB Atlas Setup

1. Create a MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (the free tier is sufficient for development)
3. Set up a database user with read/write permissions
4. Whitelist all IP addresses (0.0.0.0/0) for development purposes
5. Get your connection string from the "Connect" button in your cluster
6. Replace the placeholder values in the connection string:
   - Replace `<username>` with your MongoDB Atlas username
   - Replace `<password>` with your MongoDB Atlas password
   - Replace `<cluster-address>` with your cluster address

## Environment Variables Setup for Vercel

1. In your Vercel project settings, add the following environment variables:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Your JWT secret key
   - `BETA_BLASTER_API_KEY`: Your API key
   - `NODE_ENV`: Set to `production`

## Deployment Steps

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Configure the environment variables in Vercel project settings
4. Deploy the project

## Troubleshooting

If you encounter the "FUNCTION_INVOCATION_FAILED" error:

1. Check your MongoDB connection string in the Vercel environment variables
2. Ensure your MongoDB Atlas cluster is running and accessible
3. Check that your MongoDB Atlas IP whitelist includes 0.0.0.0/0 to allow connections from Vercel
4. Review Vercel logs for specific error messages