import { useState } from "react";
import {prepareMobilePhoto} from '@/utils/mobile-photo';
import {router} from 'expo-router';
import { showDialog, showToast } from '@/components/app-dialog';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import {Image} from 'expo-image';
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/auth/auth-context";
import { useAppTheme } from "@/theme/theme-provider";
export function ProfileAvatar({editable=false}:{editable?:boolean}) {
  const { user, api, updateProfile } = useAuth();
  const { colors: c } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await api.setAvatar(value);
      await updateProfile({});
      showToast(value ? "Foto atualizada." : "Foto removida.");
    } catch {
      showDialog(
        "Foto não atualizada",
        "Escolha uma imagem JPEG, PNG ou WebP de até 10 MB e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog(
        "Permita o acesso às fotos",
        "Para escolher uma foto, libere o acesso à galeria nas configurações do aparelho.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      try{await save((await prepareMobilePhoto(result.assets[0],true)).dataUrl);}catch{showDialog('Foto indisponível','Não foi possível processar esta foto. Tente outra imagem.');}
    }
  };
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={editable?'Alterar foto de perfil':'Editar perfil'}
        onPress={editable?pick:()=>router.push('/profile-details')}
        style={{
          width: 88,
          height: 88,
          borderRadius: 30,
          overflow: "hidden",
          backgroundColor: c.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color={c.link} />
        ) : user?.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{ width: 88, height: 88 }}
          />
        ) : (
          <Text style={{ fontSize: 30, color: c.link }}>
            {user?.firstName[0]}
          </Text>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={pick} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
        <Text style={{ color: c.link, fontWeight: "700" }}>Alterar foto</Text>
      </Pressable>
      {user?.avatarUrl ? (
        <Pressable accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            showDialog(
              "Remover foto?",
              "Seu avatar voltará a exibir a inicial do nome.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Remover foto",
                  style: "destructive",
                  onPress: () => void save(null),
                },
              ],
            )
          }
        >
          <Text style={{ color: c.danger }}>Remover foto</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
