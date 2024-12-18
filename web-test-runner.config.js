import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: ['frontend/aurora-dashboard.test.js'],
  nodeResolve: true,
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '2000'
    }
  },
  testRunnerHtml: testFramework => `
        <html>
            <body>
                <script type="module" src="${testFramework}"></script>
            </body>
        </html>
    `,
  exclude: ['**/node_modules/**/*.test.js'],
  coverageConfig: {
    include: ['frontend/**/*.js'],
    exclude: ['frontend/**/*.test.js', '**/node_modules/**']
  }
}; 