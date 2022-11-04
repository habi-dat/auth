<template>
  <v-row style="height: 100%;">
    <v-col sm="12" :md="showGroups?4:12">
      <v-form
        ref="form"
        v-model="valid">
        <v-text-field
          prepend-icon="face"
          :disabled="onlyGroups"
          v-model="user.cn"
          :rules="[v => /^[A-Za-z0-9 äüöÄÜÖß]{2,}[A-Za-z0-9äüöÄÜÖß]+$/.test(v) || 'mindestens 3 Zeichen, keine Sonderzeichen']"
          :error-messages="errors.cn"
          autocomplete="username"
          @change="checkCnAvailability"
          @input="updateUid"
          required
          hint="mindestens 3 Zeichen, keine Sonderzeichen"
          label="Anzeigename">
        </v-text-field>
        <v-text-field
          prepend-icon="person"
          :disabled="onlyGroups || !allowUid"
          v-model="user.uid"
          :rules="[v => /^[A-Za-z0-9_]{2,}[A-Za-z0-9]+$/.test(v) || 'mindestens 3 Zeichen, keine Sonderzeichen, keine Umlaute, keine Leerzeichen']"
          :error-messages="errors.uid"
          @change="checkUidAvailability"
          label="User ID">
        </v-text-field>
        <v-select
          :disabled="onlyGroups || user.memberGroups.length === 0"
          :items="user.memberGroups"
          item-text="o"
          item-value="dn"
          prepend-icon="night_shelter"
          v-model="user.ou"
          label="Zugehörigkeit"
          :rules="[ouSelected]">
        </v-select>
        <v-text-field
          :disabled="onlyGroups"
          prepend-icon="home"
          v-model="user.l"
          label="Ort">
        </v-text-field>
        <EmailField
          :disabled="onlyGroups || !allowMail"
          v-model="user.mail"
          checkAvailability
        />
        <v-select
          :disabled="onlyGroups"
          :items="languages"
          prepend-icon="language"
          v-model="user.preferredLanguage"
          label="Sprache"
          required>
        </v-select>
        <v-text-field
          prepend-icon="upload"
          :disabled="onlyGroups || !allowDescription"
          v-model="user.description"
          label="Speicherplatz"
          required>
        </v-text-field>
        <PasswordFields
          v-if="showPassword"
          v-model="user.password"
          required
        />
        <MemberField
          v-if="showGroups"
          icon="groups"
          label="Mitglied in"
          v-model="user.memberGroups"
          @input="selectGroups"
          itemText="o"
          itemValue="dn"
          tooltip="group"
          close
        />
        <MemberField
          v-if="showGroups"
          icon="groups"
          label="Admin von"
          v-model="user.ownerGroups"
          @input="selectGroups"
          itemText="o"
          itemValue="dn"
          tooltip="group"
          close
        />
      </v-form>
    </v-col>
    <v-divider v-if="showGroups" vertical />
    <v-col v-if="showGroups" md="" sm="12" minHeight="400" style="height: 100%; min-height: 400px; overflow: hidden;">
      <Toolbar title="Gruppenauswahl" icon="groups" search searchPosition="right" :searchText.sync="search"/>
      <GroupTable
        v-if="loaded"
        :groups="groups"
        :search="search"
        :flat="!$store.state.user.isAdmin"
        :selectCellItems="selectCellItems"
        @selectGroup="onSelectGroup"
        @onGridReady="params => gridApi.groups = params.api"
        @onDataRendered="selectGroups"
        comboSelect
        rowSelection="multiple"
        :heightOffset="30" />
    </v-col>
  </v-row>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import GroupTable from '@/components/group/GroupTable'
const PasswordFields = () => import('@/components/form/PasswordFields')
import EmailField from '@/components/form/EmailField'
import MemberField from '@/components/form/MemberField'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  props: {
    action: String,
    user: Object,
    showPassword: Boolean,
    showGroups: Boolean,
    onlyGroups: Boolean,
    allowUid: Boolean,
    allowMail: Boolean,
    allowDescription: Boolean,
    token: String
  },
  components: { PasswordFields, EmailField, MemberField, GroupTable, Toolbar, ToolbarButton },
  data() {
    return {
      languages: [{text: 'Deutsch', value: 'de'}, {text: 'English', value: 'en'}],
      errors: {
        cn: [],
        uid: []
      },
      valid: true,
      oldUser: {},
      gridApi: {
        groups: null
      },
      search: '',
      loaded: false,
      selectCellItems: [
          { value: 'none', icon: 'check_box_outline_blank', text: 'Kein Mitglied', color:'black'},
          { value: 'member', icon: 'portrait', text:'Mitglied', selected: true, color: 'info'},
          { value: 'owner', icon: 'edit', text: 'Admin', selected: true, color: 'success'}
        ]
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue || this.onlyGroups);
    },
    "user.memberGroups": function (newValue, oldValue) {
      if (newValue.length === 0) {
        this.user.ou = undefined;
        this.user.title = undefined;
      } else {
        this.user.ou = newValue[0].dn
        this.user.title = newValue[0].o
      }
    }
  },
  methods: {
    ouSelected(ou) {
      return !!ou || this.user.memberGroups.length === 0 || 'Bitte Zugehörigkeit auswählen'
    },
    async checkCnAvailability (cn) {
      this.errors.cn = []
      if (cn !== this.oldUser.cn) {
        try {
          var endpoint = '/api/user/available/cn/' + cn;
          if (this.token) {
            endpoint += '/' + this.token;
          }
          await axios.get(endpoint)
            .then(response => {
              if(!response.data.available) {
                this.errors.cn.push('Anzeigename ist leider bereits vergeben')
              }
            })
        } catch(error) {}
      }
    },
    onSelectGroup: function(group, selectCell) {

      // little helpers
      const pushIfNotExists = (list, group) => {
        if (!list.find(l => l.dn === group.dn)) {
          list.push(group);
        }
      }
      const deleteIfExists = (list, dn, listPopulated) => {
        if (list.find(l => l.dn === group.dn)) {
          list.splice(list.findIndex(l => l.dn === group.dn), 1);
        }
      }

      if (selectCell.value === 'owner') {
        pushIfNotExists(this.user.memberGroups, group);
        pushIfNotExists(this.user.ownerGroups,group);
      } else if (selectCell.value === 'member') {
        pushIfNotExists(this.user.memberGroups, group);
        deleteIfExists(this.user.ownerGroups, group)
      } else {
        deleteIfExists(this.user.memberGroups, group);
        deleteIfExists(this.user.ownerGroups, group);
      }
    },
    selectGroups() {
      this.gridApi.groups.forEachNode(rowNode => {
        var selectCell;
        if (this.user.ownerGroups.find(o => o.dn === rowNode.data.dn)) {
          if (this.user.memberGroups.find(m => m.dn === rowNode.data.dn)) {
            selectCell = this.selectCellItems[2]
          } else {
            this.user.ownerGroups.splice(this.user.ownerGroups.findIndex(o => o.dn === rowNode.data.dn), 1)
            selectCell = this.selectCellItems[0]
          }
        } else if (this.user.memberGroups.find(m => m.dn === rowNode.data.dn)) {
          selectCell = this.selectCellItems[1]
        } else {
          selectCell = this.selectCellItems[0]
        }
        if (selectCell && selectCell !== rowNode.data.selectCell) {
          rowNode.data.selectCell = selectCell;
          rowNode.setData(rowNode.data);
        }
      });
    },
    async checkUidAvailability (uid) {
      this.errors.uid = []
      if (uid !== this.oldUser.uid) {
        try {
          var endpoint = '/api/user/available/uid/' + uid;
          if (this.token) {
            endpoint += '/' + this.token
          }
          await axios.get('/api/user/available/uid/' + uid)
            .then(response => {
              if(!response.data.available) {
                this.errors.uid.push('User ID ist leider bereits vergeben')
              }
            })
        } catch(error) {}
      }
    },
    updateUid(newCn) {
      if (this.allowUid) {
        this.user.uid = newCn.toLowerCase()
              .replaceAll('ä', 'ae')
              .replaceAll('ö', 'oe')
              .replaceAll('ü', 'ue')
              .replaceAll('ß', 'ss')
              .replaceAll(' ', '_')
              .replaceAll(/[\W]+/g,"")
              .substr(0,35);
      }
    },
    getGroups () {
      axios.get('/api/groups')
        .then(response => {
          this.groups = response.data.groups;
          this.loaded = true;
        })
        .catch(e => {});
    }
  },
  created() {
    this.oldUser = {... this.user};
    if (this.user && this.user.ou && this.user.member && !this.user.member.includes(this.user.ou)) {
      this.user.ou = undefined;
    }
    if (this.showGroups) {
      this.getGroups();
    }
  }
}
</script>