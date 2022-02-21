## Getting Started for Development

Environment variables for this project is managed through Doppler. If you havent got your account, contact @Heedster for the same. 
- [Install Doppler CLI](https://docs.doppler.com/docs/install-cli) and login, if not already
- Clone the project
- In the project directory, run `doppler setup` to setup the environment. 
- Next, run the development server:

```bash
npm run dev
# or
yarn dev
```

Voila!

### Adding/Changing Environment Variables.

To add/change environment variables during development of a feature, use the branching feature of doppler to create you own branch.
Add the environment variable to ConfigProvider.ts as well as to the Joi Schema in create-env.ts.

Dont forget to add the config to Root of dev, staging and production (contact whoever has admin permission) before merging your branch, else the build and deployment will fail. 
