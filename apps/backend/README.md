# 🚀 Build and run instructions
```
cp .env.example .env
yarn install
yarn dev
```

# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

## AI provider configuration

The default provider is deterministic. Set `CSRM_AI_PROVIDER=openai-compatible` to use a compatible endpoint. Assessment drafting and questionnaire generation have independent `BASE_URL`, `API_KEY`, and `MODEL` triples, so each operation can use a different endpoint and model without a code change. Any compatible backend is reached by changing its base URL and model; a backend with a different wire format can be reached through an operator-managed translating gateway.

An API key is optional: leave it blank for a keyless self-hosted server. Trust for a private certificate authority is an operating-system deployment concern; configure it with `NODE_EXTRA_CA_CERTS`, not an application setting.

Structured output is enabled by default. Disable `CSRM_AI_STRUCTURED_OUTPUT` only for a backend that rejects or silently ignores the structured-output request field. Responses are still checked against the closed shape, so compatibility layers that return unconstrained text fail safely as invalid output.

`CSRM_AI_REQUEST_TIMEOUT_MS` defaults to 60 seconds. The output caps default to 8,000 tokens for assessment drafts and 16,000 for questionnaires; requests use the classic chat-completions output-cap field. If a reasoning endpoint requires a newer field name, place a translating gateway in front of it.

Context-window sizing is an operator responsibility. The application never trims, samples, or clips questionnaire answers, Risk Types, or Control reference data to fit a smaller window. Configure a model that can hold the complete context; otherwise the job fails loudly rather than silently dropping risk-relevant data. Automated test runs force the deterministic provider regardless of `.env` contents.

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
