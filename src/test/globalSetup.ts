import React from 'react';
import { act } from 'react';

export function setup() {
  if (!React.act) {
    React.act = act;
  }
}
