for developer to write down bugs and stuff


1.) store log in infinite loop

-delete vite cache and restart shopify app dev

2.) shopify admin connection issue blank page

-close shopify tab and open again (sometimes cloudfare tunnel takes some time to setup properly so just keep retrying)

Setup phase

1.) Download shopify CLI
2.) make sure shopify cli able to execute on your machine (policy issues)
3.) run shopify app dev
    -choose connect to existing app
    -choose fitback (shopify.app.toml)
4.) wait for shopify cli to finish setup
5.) press p to open shopify admin, g to open local graphql for database queries testing

