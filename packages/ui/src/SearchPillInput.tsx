import { forwardRef } from "react";
import {
  Pressable,
  TextInput,
  View,
  type Insets,
  type TextInputProps,
} from "react-native";
import { Search, X, type LucideIcon } from "lucide-react-native";

import { Icon } from "./Icon";
import { useNaroTheme } from "./theme";

const SMALL_HIT_SLOP: Insets = { bottom: 8, left: 8, right: 8, top: 8 };

export type SearchPillInputProps = Omit<
  TextInputProps,
  "className" | "onChangeText" | "value"
> & {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  icon?: LucideIcon;
  className?: string;
  inputClassName?: string;
  clearAccessibilityLabel?: string;
};

export const SearchPillInput = forwardRef<TextInput, SearchPillInputProps>(
  function SearchPillInput(
    {
      value,
      onChangeText,
      onClear,
      icon = Search,
      placeholder,
      className,
      inputClassName,
      clearAccessibilityLabel = "Aramayı temizle",
      returnKeyType = "search",
      autoCorrect = false,
      autoCapitalize = "none",
      ...rest
    },
    ref,
  ) {
    const { colors } = useNaroTheme();
    const clear = onClear ?? (() => onChangeText(""));

    return (
      <View
        className={[
          "h-[46px] min-w-0 flex-1 flex-row items-center gap-2 rounded-full border border-app-outline-strong bg-app-surface px-3",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Icon icon={icon} size={18} color={colors.info} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          returnKeyType={returnKeyType}
          autoCorrect={autoCorrect}
          autoCapitalize={autoCapitalize}
          className={[
            "min-h-[44px] flex-1 text-[15px] text-app-text",
            inputClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearAccessibilityLabel}
            hitSlop={SMALL_HIT_SLOP}
            onPress={clear}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-app-surface-2"
          >
            <Icon icon={X} size={15} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
    );
  },
);
