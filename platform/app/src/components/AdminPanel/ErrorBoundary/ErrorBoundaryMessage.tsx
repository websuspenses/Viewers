import React from 'react';

function ErrorBoundaryMessage(props) {
  const {errorMessage} = props;
//   throw new Error('Oops, something went wrong!');
throw new Error(errorMessage + '!');
  return <div>Hello World!</div>;
}

export default ErrorBoundaryMessage;