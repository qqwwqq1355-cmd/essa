import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { Icon } from './Icon';

interface PlaylistPickerModalProps {
  theme: ThemePalette;
}

export const PlaylistPickerModal: React.FC<PlaylistPickerModalProps> = ({ theme }) => {
  const {
    playlistPickerTrackId,
    closePlaylistPicker,
    playlists,
    tracks,
    toggleTrackInPlaylist,
    createPlaylist,
  } = useAppStore();

  const [newName, setNewName] = useState('');

  if (!playlistPickerTrackId) return null;

  const track = tracks.find((t) => t.id === playlistPickerTrackId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createPlaylist(newName.trim(), playlistPickerTrackId);
    setNewName('');
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: theme.bgElevated, borderColor: theme.borderStrong }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>إضافة إلى قائمة تشغيل</Text>
            {track && (
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {track.title}
              </Text>
            )}
          </View>
          <Pressable onPress={closePlaylistPicker} style={styles.closeBtn}>
            <Icon name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="اسم قائمة جديدة..."
            placeholderTextColor={theme.textMuted}
            onSubmitEditing={handleCreate}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.textPrimary,
              },
            ]}
          />
          <Pressable
            onPress={handleCreate}
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
          >
            <Icon name="plus" size={18} color={theme.accentText} />
            <Text style={[styles.addBtnText, { color: theme.accentText }]}>إنشاء</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {playlists.map((pl) => {
            const included = pl.trackIds.includes(playlistPickerTrackId);
            return (
              <Pressable
                key={pl.id}
                onPress={() => toggleTrackInPlaylist(pl.id, playlistPickerTrackId)}
                style={[
                  styles.row,
                  {
                    backgroundColor: included ? theme.accentSoft : theme.surface,
                    borderColor: included ? theme.accent : theme.border,
                  },
                ]}
              >
                <View style={styles.rowMeta}>
                  <Text style={[styles.plName, { color: theme.textPrimary }]}>{pl.name}</Text>
                  <Text style={[styles.plCount, { color: theme.textSecondary }]}>
                    {pl.trackIds.length} مقطع
                  </Text>
                </View>
                <Icon
                  name={included ? 'check-circle' : 'plus'}
                  size={20}
                  color={included ? theme.accent : theme.textMuted}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 55,
    justifyContent: 'flex-end',
    padding: 10,
  },
  sheet: {
    maxHeight: '72%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    textAlign: 'right',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowMeta: {
    gap: 2,
  },
  plName: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  plCount: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
});

