import React from 'react';
import styles from './Layout.less';

export default function Layout({ children }) {
  return (
    <div>
      <h1 className={styles.label}>Hello, world!</h1>
      {children}
    </div>
  );
}
