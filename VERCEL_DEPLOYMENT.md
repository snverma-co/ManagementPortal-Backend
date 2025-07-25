# Vercel Deployment Guide for Express.js MongoDB Backend

## Prerequisites

1. A MongoDB Atlas account with a cluster set up
2. A Vercel account
3. Your project code pushed to a GitHub repository

## Step 1: Set Up MongoDB Atlas

1. Create a free MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (the free tier is sufficient for development)
3. Set up a database user with read/write permissions
   - Go to Database Access → Add New Database User
   - Create a username and password (use a strong password)
   - Set privileges to "Read and Write to Any Database"
4. Whitelist all IP addresses to allow connections from Vercel
   - Go to Network Access → Add IP Address
   - Add `0.0.0.0/0` to allow connections from anywhere
5. Get your connection string
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user's password
   - Replace `<dbname>` with `ca_portal`

## Step 2: Set Up Environment Variables in Vercel

1. Go to your Vercel dashboard and select your project
2. Go to Settings → Environment Variables
3. Add the following environment variables:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Your JWT secret key
   - `BETA_BLASTER_API_KEY`: Your API key
   - `NODE_ENV`: Set to `production`

## Step 3: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Configure the project settings:
   - Set the root directory to `backend` if your repository contains both frontend and backend
   - Set the build command to `npm install`
   - Set the output directory to `.`
3. Deploy the project

## Step 4: Verify Deployment

1. Once deployed, visit your deployment URL to check the health endpoint
2. Visit `https://your-deployment-url/api/health` to verify the MongoDB connection

## Troubleshooting Common Issues

### FUNCTION_INVOCATION_FAILED Error

1. **Check MongoDB Connection String**
   - Verify that your MongoDB Atlas connection string is correct in Vercel environment variables
   - Ensure you've replaced `<username>`, `<password>`, and `<cluster-address>` with actual values

2. **MongoDB Atlas Network Access**
   - Confirm that you've whitelisted all IP addresses (`0.0.0.0/0`) in MongoDB Atlas

3. **Vercel Function Timeout**
   - If your function is timing out, check the `maxDuration` setting in `vercel.json`
   - Consider optimizing your database queries for better performance

4. **Memory Issues**
   - If you're experiencing memory issues, check the `memory` setting in `vercel.json`
   - Consider optimizing your code to use less memory

### Debugging Tips

1. Use the health check endpoint (`/api/health`) to verify your MongoDB connection
2. Check Vercel logs for detailed error messages
3. Test your API locally before deploying to Vercel
4. Use the enhanced error handling in the server.js file to get more detailed error information