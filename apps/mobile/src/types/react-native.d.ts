declare module 'react-native' {
  import type { ComponentType, ReactNode, Ref } from 'react';

  export type StyleProp<T> = T | false | null | undefined | ReadonlyArray<StyleProp<T>>;

  export interface FlexStyle {
    alignContent?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    aspectRatio?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
    borderTopWidth?: number;
    borderWidth?: number;
    bottom?: number | string;
    display?: 'none' | 'flex';
    flex?: number;
    flexBasis?: number | string;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    flexGrow?: number;
    flexShrink?: number;
    flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    height?: number | string;
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
    left?: number | string;
    margin?: number | string;
    marginBottom?: number | string;
    marginHorizontal?: number | string;
    marginLeft?: number | string;
    marginRight?: number | string;
    marginTop?: number | string;
    marginVertical?: number | string;
    maxHeight?: number | string;
    maxWidth?: number | string;
    minHeight?: number | string;
    minWidth?: number | string;
    overflow?: 'visible' | 'hidden' | 'scroll';
    padding?: number | string;
    paddingBottom?: number | string;
    paddingHorizontal?: number | string;
    paddingLeft?: number | string;
    paddingRight?: number | string;
    paddingTop?: number | string;
    paddingVertical?: number | string;
    position?: 'absolute' | 'relative' | 'fixed';
    right?: number | string;
    top?: number | string;
    width?: number | string;
    zIndex?: number;
  }

  export interface ViewStyle extends FlexStyle {
    backgroundColor?: string;
    borderBottomColor?: string;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    borderColor?: string;
    borderRadius?: number;
    borderStyle?: 'solid' | 'dotted' | 'dashed';
    borderTopColor?: string;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    elevation?: number;
    opacity?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    transform?: Array<Record<string, number | string>>;
    cursor?: string;
    userSelect?: string;
    backdropFilter?: string;
    WebkitBackdropFilter?: string;
    backgroundImage?: string;
    transition?: string;
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: 'normal' | 'italic';
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    writingDirection?: 'auto' | 'ltr' | 'rtl';
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    tintColor?: string;
  }

  export interface ViewProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
    accessibilityLabel?: string;
    accessibilityRole?: string;
  }

  export interface TextProps {
    children?: ReactNode;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    selectable?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
  }

  export interface PressableStateCallbackType {
    pressed: boolean;
    hovered?: boolean;
    focused?: boolean;
  }

  export interface PressableProps extends Omit<ViewProps, 'style' | 'children'> {
    children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    onPress?: (event: unknown) => void;
    onLongPress?: (event: unknown) => void;
    disabled?: boolean;
    hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
    accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  }

  export interface ScrollViewProps extends ViewProps {
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    ref?: Ref<unknown>;
  }

  export interface TextInputProps {
    value?: string;
    defaultValue?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    style?: StyleProp<TextStyle>;
    multiline?: boolean;
    numberOfLines?: number;
    autoFocus?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    returnKeyType?: string;
    onSubmitEditing?: () => void;
    accessibilityLabel?: string;
  }

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    children?: ReactNode;
  }

  export interface ActivityIndicatorProps {
    size?: 'small' | 'large' | number;
    color?: string;
    style?: StyleProp<ViewStyle>;
  }

  export const View: ComponentType<ViewProps>;
  export const SafeAreaView: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const Modal: ComponentType<ModalProps>;
  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>;

  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T;
    flatten<T>(style: StyleProp<T>): T;
    hairlineWidth: number;
    absoluteFillObject: ViewStyle;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'web' | 'windows' | 'macos';
    select<T>(specifics: Partial<Record<'ios' | 'android' | 'web' | 'default', T>>): T;
  };

  export const Dimensions: {
    get(dim: 'window' | 'screen'): { width: number; height: number; scale: number; fontScale: number };
    addEventListener(
      type: 'change',
      handler: (dims: { window: { width: number; height: number } }) => void
    ): { remove: () => void };
  };

  export const I18nManager: {
    isRTL: boolean;
    allowRTL(allow: boolean): void;
    forceRTL(force: boolean): void;
  };

  export const Linking: {
    openURL(url: string): Promise<void>;
    canOpenURL(url: string): Promise<boolean>;
  };

  export const AppRegistry: {
    registerComponent(appKey: string, componentProvider: () => ComponentType): void;
    runApplication(appKey: string, appParams: { rootTag: HTMLElement | null }): void;
  };
}

