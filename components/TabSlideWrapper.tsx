import { View } from 'react-native';

interface Props {
  children: React.ReactNode;
  myIndex: number;
}

export function TabSlideWrapper({ children }: Props) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
