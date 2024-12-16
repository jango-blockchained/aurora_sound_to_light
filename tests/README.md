# Testing Documentation

This directory contains all test files for the Aurora Sound to Light project. The tests are organized into different categories and follow specific conventions to maintain consistency and clarity.

## Directory Structure

```plaintext
tests/
├── frontend/
│   ├── unit/                 # Unit tests for frontend components
│   ├── integration/          # Integration tests for frontend
│   ├── e2e/                  # End-to-end tests
│   └── setup/               # Test setup and utilities
├── backend/
│   ├── conftest.py          # Pytest fixtures for backend
│   ├── test_*.py            # Unit tests for backend components
│   └── integration/         # Integration tests for backend
└── README.md                # This file
```

## Test Categories

### Frontend Tests

1. **Unit Tests** (`frontend/unit/`)
   - Test individual components in isolation
   - Focus on component logic and rendering
   - Naming convention: `component-name.test.js`

2. **Integration Tests** (`frontend/integration/`)
   - Test component interactions
   - Focus on component communication and state management
   - Naming convention: `component-name.integration.test.js`

3. **End-to-End Tests** (`frontend/e2e/`)
   - Test complete user workflows
   - Focus on user interactions and system behavior
   - Naming convention: `feature-name.e2e.test.js`

### Backend Tests

1. **Unit Tests** (`backend/`)
   - Test individual Python modules and functions
   - Focus on business logic and data processing
   - Naming convention: `test_module_name.py`

2. **Integration Tests** (`backend/integration/`)
   - Test interactions between multiple backend components
   - Focus on API endpoints and data flow
   - Naming convention: `test_feature_name.py`

## Running Tests

### Frontend Tests

```bash
# Run all frontend tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Backend Tests

```bash
# Run all backend tests
pytest

# Run specific test file
pytest tests/backend/test_audio_processor.py

# Run tests with coverage
pytest --cov=custom_components/aurora_sound_to_light
```

## Writing Tests

### Frontend Test Guidelines

1. **Component Tests**
   - Use `@open-wc/testing` for component testing
   - Mock external dependencies (Home Assistant, WebSocket)
   - Test both success and error scenarios
   - Verify DOM updates and event handling

2. **Test Structure**
   ```javascript
   describe('ComponentName', () => {
       let element;
       let mockHass;

       beforeEach(async () => {
           // Setup
       });

       afterEach(() => {
           // Cleanup
       });

       it('should do something specific', async () => {
           // Test case
       });
   });
   ```

### Backend Test Guidelines

1. **Python Tests**
   - Use pytest fixtures for common setup
   - Mock external services and API calls
   - Test edge cases and error handling
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Test Structure**
   ```python
   def test_function_name(fixture1, fixture2):
       # Arrange
       input_data = ...

       # Act
       result = function_under_test(input_data)

       # Assert
       assert result == expected_output
   ```

## Code Coverage

- Frontend coverage reports are generated in the `coverage/` directory
- Backend coverage is tracked using pytest-cov
- Minimum coverage requirements:
  - Statements: 80%
  - Branches: 80%
  - Functions: 80%
  - Lines: 80%

## Best Practices

1. **Test Independence**
   - Each test should be independent and not rely on other tests
   - Clean up any modifications after each test
   - Use fresh fixtures for each test

2. **Meaningful Assertions**
   - Write clear, specific assertions
   - Test both positive and negative cases
   - Include error handling tests

3. **Mock External Dependencies**
   - Mock Home Assistant API calls
   - Mock WebSocket connections
   - Mock file system operations

4. **Maintainable Tests**
   - Keep tests focused and concise
   - Use descriptive test names
   - Document complex test setups

5. **Continuous Integration**
   - All tests must pass before merging
   - Coverage requirements must be met
   - Linting rules must be followed

## Contributing

When adding new features or modifying existing ones:

1. Write tests before implementing features (TDD approach)
2. Ensure all tests pass locally before pushing
3. Maintain or improve code coverage
4. Follow existing naming conventions and patterns
5. Update test documentation as needed 