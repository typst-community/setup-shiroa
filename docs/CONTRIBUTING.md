# Contributing
Thank you for considering to contribute to this GitHub Action!

Contributing is fairly simple, all you need is Node.js Version 20.
Though, for a better experience we recommend using an editor with the TypeScript Language Server and having the TypeScript Compiler installed.

Run `npm clean-install` to prepare your node environment, then you can add your changes.
To test your code run `npm run lint` and `npm run build`, this will not test the actual code, but it will check that it is correct.
Most of this will be done inline if you have the Language Server running.

Once you push your changes and open a PR you can continuously test by updating the PR, the CI workflows will test the action on some pre-selected inputs.
