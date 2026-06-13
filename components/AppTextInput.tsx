import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

/**
 * App-wide text input.
 *
 * Wraps React Native's TextInput and opts every field out of iOS AutoFill
 * classification by default. iOS AutoFill is what renders the spaced-out
 * "secure text" placeholder/value (e.g. "F i r s t   n a m e") — disabling the
 * content-type heuristics kills it everywhere. Individual fields can still
 * override any of these (e.g. the bio field re-enabling spellCheck), since the
 * caller's props are spread after the defaults.
 */
const AppTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <TextInput
    autoComplete="off"
    textContentType="none"
    importantForAutofill="no"
    {...props}
    ref={ref}
  />
));

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
