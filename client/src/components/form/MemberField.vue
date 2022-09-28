<template>
  <v-combobox
    :prepend-icon="icon"
    :value="value"
    @input="val => $emit('input', val)"
    :item-text="itemText"
    :item-value="itemValue"
    :rules="rules"
    small-chips
    :label="label"
    multiple
    readonly
  >
    <template v-if="close" v-slot:selection="{ attrs, item, parent, selected }">
      <v-chip
        v-bind="attrs"
        :input-value="selected"
        label
        small
      >
        <v-tooltip  bottom color="transparent">
          <template v-slot:activator="{ on, attrs }">
            <span class="pr-2" v-bind="attrs" v-on="on">
              {{ item[itemText] }}
            </span>
          </template>
          <GroupTooltip
            v-if="tooltip === 'group'"
            :group="item"
          />
          <UserTooltip
            v-if="tooltip === 'user'"
            :user="item"
          />
        </v-tooltip>
        <v-icon
          small
          @click="parent.selectItem(item)"
        >
          close
        </v-icon>
      </v-chip>
    </template>
  </v-combobox>
</template>

<script>
import GroupTooltip from '@/components/group/GroupTooltip'
import UserTooltip from '@/components/user/UserTooltip'

export default {
  name: 'MemberField',
  components: { GroupTooltip, UserTooltip },
  props: {
    icon: String,
    value: Array,
    label: String,
    itemText: String,
    itemValue: String,
    tooltip: String,
    rules: Array,
    close: Boolean
  }
};

</script>
