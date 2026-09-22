import config from '@ei-ai/eslint-config';

export default [...config, { languageOptions: { parserOptions: { projectService: false } } }];
