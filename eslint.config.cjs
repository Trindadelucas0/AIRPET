'use strict';

/**
 * Regras focadas: SQL deve permanecer em src/models.
 * Controllers, services e routes não devem importar `query` de database.
 */
module.exports = [
  {
    files: ['src/controllers/**/*.js', 'src/services/**/*.js', 'src/routes/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../config/database',
              importNames: ['query'],
              message:
                'Mantenha SQL nos models em src/models; não importe query nesta camada.',
            },
          ],
        },
      ],
    },
  },
];
