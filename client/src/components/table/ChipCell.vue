<template>
  <v-chip-group column>
    <v-chip v-if="items.length === 0 && params.emptyValue"  label outlined small >
      {{ params.emptyValue }}
    </v-chip>
    <v-tooltip v-if="!singleLine" v-for="item in items" v-bind:key="item.cn" bottom color="transparent">
      <template v-slot:activator="{ on, attrs }">
        <v-chip label outlined small v-bind="attrs" v-on="on">
          <v-icon v-if="params.icon" left :color="params.color" small> {{ params.icon }} </v-icon>
          {{ getText(item) }}
        </v-chip>
      </template>
      <GroupTooltip
        v-if="params.tooltip === 'group'"
        :group="item"
      />
      <UserTooltip
        v-if="params.tooltip === 'user'"
        :user="item"
      />
    </v-tooltip>
    <v-tooltip v-if="singleLine && items.length > 0" bottom color="transparent">
      <template v-slot:activator="{ on, attrs }">
        <v-chip label outlined small v-bind="attrs" v-on="on">
          <v-icon v-if="params.icon" left :color="params.color" small> {{ params.icon }} </v-icon>
          {{  getText(items[0]) }}
        </v-chip>
      </template>
      <GroupTooltip
        v-if="params.tooltip === 'group'"
        :group="items[0]"
      />
      <UserTooltip
        v-if="params.tooltip === 'user'"
        :user="items[0]"
      />
    </v-tooltip>
    <v-tooltip bottom :max-width="tooltipWidth" min-width="200" v-if="singleLine && items.length > 1">
      <template v-slot:activator="{ on, attrs }">
        <v-chip @click="event => singleLine=!singleLine" v-bind="attrs" v-on="on"    key="more" label outlined small>
          <v-icon v-if="params.icon" left :color="params.color" small> {{ params.icon }} </v-icon>
          + {{items.length-1}}
        </v-chip>
      </template>
      <v-chip-group column >
       <v-chip  v-for="item in items.slice(1,items.length)" v-bind:key="item.cn" label  small>
         <v-icon v-if="params.icon" left :color="params.color" small> {{ params.icon }} </v-icon>
         {{  getText(item) }}
       </v-chip>
      </v-chip-group>
    </v-tooltip>
  </v-chip-group>
</template>

<script>
import GroupTooltip from '@/components/group/GroupTooltip'
import UserTooltip from '@/components/user/UserTooltip'

export default {
  name: 'ChipCell',
  components: { GroupTooltip, UserTooltip },
  data () {
    return {
      items: [],
      singleLine: false
    };
  },
  methods: {
    getText(object) {
      if (this.params.field) {
        return object[this.params.field]
      } else {
        return object;
      }
    }
  },
  beforeMount() {
    this.singleLine = this.params.singleLine || true;
    this.items = this.params.value;
    if (this.items && this.items.length > 1) {
      this.tooltipWidth = Math.max.apply(null, this.items.map(item => item.length))*9
    }
  },
};

</script>