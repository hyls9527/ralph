import React from 'react';
import { act } from 'react';
import testUtils from 'react-dom/test-utils';

if (!React.act) {
  React.act = act;
}

export default testUtils;
