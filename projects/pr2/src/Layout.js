import React from 'react';
import moment from 'moment';

export default function Layout({ children }) {
  return (
    <div>
      <h1>Hello, world! {moment().format()}</h1>
      {children}
    </div>
  );
}
