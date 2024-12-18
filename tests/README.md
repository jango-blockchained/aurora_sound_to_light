# Testing Documentation

This directory contains all test files for the Aurora Sound to Light project. The tests are organized into different categories and follow specific conventions to maintain consistency and clarity.

## Directory Structure

```plaintext
tests/
├── conftest.py              # Pytest fixtures and test configuration
├── requirements_test.txt    # Test-specific dependencies
├── core/                    # Core functionality tests
├── frontend/               # Frontend-related tests
│   ├── e2e/               # End-to-end tests
│   ├── integration/       # Frontend integration tests
│   ├── setup/            # Test setup and utilities
│   ├── unit/             # Unit tests for frontend components
│   └── jest.config.js    # Jest configuration for frontend tests
├── integration/           # Backend integration tests
├── test_audio_processor.py  # Audio processing unit tests
├── test_cache.py           # Cache system unit tests
├── test_light_controller.py # Light controller unit tests
└── README.md               # This documentation file
```

## Test Categories

### Core Tests
- Unit tests for fundamental system components
- Located in `core/` directory
- Focus on core business logic and data processing

### Frontend Tests (`frontend/`)

1. **Unit Tests** (`frontend/unit/`)
   - Individual component testing
   - Component logic and rendering
   - Isolated component behavior

2. **Integration Tests** (`frontend/integration/`)
   - Component interaction testing
   - State management
   - Cross-component communication

3. **End-to-End Tests** (`frontend/e2e/`)
   - Complete user workflow testing
   - Full system interaction
   - User experience validation

4. **Setup** (`frontend/setup/`)
   - Test utilities and helpers
   - Common test configurations
   - Shared test resources

### Backend Tests

1. **Unit Tests** (Root level `test_*.py` files)
   - `test_audio_processor.py`: Audio processing functionality
   - `test_cache.py`: Caching system
   - `test_light_controller.py`: Light control operations

2. **Integration Tests** (`integration/`)
   - System component interaction
   - API endpoint testing
   - Data flow validation

## Running Tests

### Frontend Tests

```bash
# Run all frontend tests
npm run test:frontend

# Run specific test categories
npm run test:frontend:unit
npm run test:frontend:integration
npm run test:frontend:e2e

# Run with coverage
npm run test:coverage
```

### Backend Tests

```bash
# Run all backend tests
pytest

# Run specific test file
pytest tests/test_audio_processor.py

# Run with coverage
pytest --cov=custom_components/aurora_sound_to_light
```

## Writing Tests

### Frontend Test Guidelines

1. **Component Tests**
   ```javascript
   describe('ComponentName', () => {
       let element;
       
       beforeEach(async () => {
           element = await fixture(html`<component-name></component-name>`);
       });

       it('should have expected properties', () => {
           expect(element).to.have.property('propertyName');
       });
   });
   ```

### Backend Test Guidelines

1. **Python Tests**
   ```python
   def test_function_name(setup_fixture):
       # Arrange
       input_data = prepare_test_data()

       # Act
       result = function_under_test(input_data)

       # Assert
       assert result == expected_output
   ```

## Best Practices

1. **Test Independence**
   - Each test should be self-contained
   - Use appropriate fixtures
   - Clean up after tests

2. **Code Coverage**
   - Maintain minimum 80% coverage
   - Test edge cases
   - Include error scenarios

3. **Naming Conventions**
   - Backend: `test_*.py`
   - Frontend: `*.test.js`
   - Descriptive test names

4. **Documentation**
   - Document test purpose
   - Include setup requirements
   - Explain complex test scenarios

## Contributing

1. Write tests for new features
2. Maintain existing test coverage
3. Follow established patterns
4. Update documentation
5. Ensure CI/CD compliance

For detailed information about specific test implementations, refer to the respective test files and their documentation.