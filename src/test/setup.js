const path = require('path');
const mockPath = path.resolve(__dirname, 'mocks/vscode.js');

require.cache['vscode'] = {
    id: 'vscode',
    filename: mockPath,
    loaded: true,
    exports: require(mockPath)
};