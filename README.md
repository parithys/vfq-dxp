# vfq-dxp

A working prototype of the Vodafone Qatar (VFQ) Digital Experience Platform for retail and contact-centre agents: guided sales and service journeys, Customer 360 and the work queues around them. It runs in the browser against synthetic data, with no backend.

The application is in [`vfq-dxp-app/`](vfq-dxp-app/). See its [README](vfq-dxp-app/README.md) for what is in it, how it is organised and how to sign in.

## Quick start

Needs Node.js 22 or later.

```bash
cd vfq-dxp-app
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # automated suite
npm run build      # type-check and production build
```

GitHub Actions runs lint, the tests and the build on every push and pull request.

## License

MIT. See [LICENSE](LICENSE).
