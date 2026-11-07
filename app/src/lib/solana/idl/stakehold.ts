/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/stakehold.json`.
 */
export type Stakehold = {
  "address": "87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec",
  "metadata": {
    "name": "stakehold",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Stakehold: survivor-style habit challenges with SOL stakes"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "challenge",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              }
            ]
          }
        },
        {
          "name": "participant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createChallenge",
      "discriminator": [
        170,
        244,
        47,
        1,
        1,
        15,
        173,
        239
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "challenge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "args.id"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createChallengeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "donateToPool",
      "discriminator": [
        219,
        179,
        202,
        183,
        26,
        49,
        206,
        250
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "eliminateMissed",
      "discriminator": [
        245,
        191,
        243,
        16,
        118,
        76,
        1,
        184
      ],
      "accounts": [
        {
          "name": "challenge",
          "writable": true,
          "relations": [
            "participant"
          ]
        },
        {
          "name": "participant",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "day",
          "type": "u16"
        }
      ]
    },
    {
      "name": "forfeit",
      "discriminator": [
        80,
        154,
        237,
        158,
        244,
        198,
        154,
        9
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "challenge",
          "writable": true
        },
        {
          "name": "participant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "configArgs"
            }
          }
        }
      ]
    },
    {
      "name": "joinChallenge",
      "discriminator": [
        41,
        104,
        214,
        73,
        32,
        168,
        76,
        79
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "challenge",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              }
            ]
          }
        },
        {
          "name": "participant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "utcOffsetMin",
          "type": "i16"
        }
      ]
    },
    {
      "name": "openWindow",
      "discriminator": [
        51,
        40,
        53,
        181,
        170,
        43,
        128,
        168
      ],
      "accounts": [
        {
          "name": "judge",
          "writable": true,
          "signer": true
        },
        {
          "name": "challenge",
          "relations": [
            "participant"
          ]
        },
        {
          "name": "participant"
        },
        {
          "name": "window",
          "writable": true
        },
        {
          "name": "prevWindow",
          "docs": [
            "Earlier window the same day (e.g. the gym check-in), so the new pose can differ."
          ],
          "optional": true
        },
        {
          "name": "slotHashes",
          "docs": [
            "full sysvar is too large to deserialize."
          ],
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "day",
          "type": "u16"
        },
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "recordCheckin",
      "discriminator": [
        118,
        204,
        183,
        163,
        118,
        202,
        223,
        127
      ],
      "accounts": [
        {
          "name": "judge",
          "writable": true,
          "signer": true
        },
        {
          "name": "challenge",
          "relations": [
            "participant"
          ]
        },
        {
          "name": "participant",
          "writable": true
        },
        {
          "name": "checkin",
          "writable": true
        },
        {
          "name": "window",
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "checkInArgs"
            }
          }
        }
      ]
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "challenge",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "challenge"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "charity",
          "writable": true,
          "optional": true
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "configArgs"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "challenge",
      "discriminator": [
        119,
        250,
        161,
        121,
        119,
        81,
        22,
        208
      ]
    },
    {
      "name": "checkIn",
      "discriminator": [
        16,
        127,
        31,
        218,
        222,
        207,
        180,
        33
      ]
    },
    {
      "name": "communityPool",
      "discriminator": [
        56,
        185,
        253,
        148,
        127,
        79,
        154,
        126
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "participant",
      "discriminator": [
        32,
        142,
        108,
        79,
        247,
        179,
        54,
        6
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "window",
      "discriminator": [
        66,
        77,
        66,
        242,
        153,
        13,
        1,
        69
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the admin can do this"
    },
    {
      "code": 6001,
      "name": "invalidMode",
      "msg": "Invalid challenge mode"
    },
    {
      "code": 6002,
      "name": "invalidStake",
      "msg": "Stake amount out of range"
    },
    {
      "code": 6003,
      "name": "startInPast",
      "msg": "Start time must be in the future"
    },
    {
      "code": 6004,
      "name": "invalidDayLength",
      "msg": "Invalid day length"
    },
    {
      "code": 6005,
      "name": "invalidDays",
      "msg": "Invalid number of days"
    },
    {
      "code": 6006,
      "name": "invalidGrace",
      "msg": "Invalid grace period"
    },
    {
      "code": 6007,
      "name": "invalidMaxPlayers",
      "msg": "Invalid max players"
    },
    {
      "code": 6008,
      "name": "invalidFailDestination",
      "msg": "Invalid failure destination"
    },
    {
      "code": 6009,
      "name": "invalidCharity",
      "msg": "Charity is not on the approved list"
    },
    {
      "code": 6010,
      "name": "challengeFull",
      "msg": "Challenge is full"
    },
    {
      "code": 6011,
      "name": "alreadyStarted",
      "msg": "Challenge has already started for you"
    },
    {
      "code": 6012,
      "name": "invalidOffset",
      "msg": "Invalid UTC offset"
    },
    {
      "code": 6013,
      "name": "soloCreatorOnly",
      "msg": "Solo challenges can only be joined by their creator"
    },
    {
      "code": 6014,
      "name": "alreadySettled",
      "msg": "Challenge is already settled"
    },
    {
      "code": 6015,
      "name": "notSettled",
      "msg": "Challenge is not settled yet"
    },
    {
      "code": 6016,
      "name": "notActive",
      "msg": "Participant is not active"
    },
    {
      "code": 6017,
      "name": "invalidDay",
      "msg": "Day is out of range"
    },
    {
      "code": 6018,
      "name": "wrongDay",
      "msg": "That day is not open right now"
    },
    {
      "code": 6019,
      "name": "tooLate",
      "msg": "Too late to record this day"
    },
    {
      "code": 6020,
      "name": "invalidVerdict",
      "msg": "Invalid verdict"
    },
    {
      "code": 6021,
      "name": "windowMismatch",
      "msg": "Window does not belong to this participant/day"
    },
    {
      "code": 6022,
      "name": "windowExpired",
      "msg": "Proof window has expired"
    },
    {
      "code": 6023,
      "name": "invalidWindowIndex",
      "msg": "Invalid window index"
    },
    {
      "code": 6024,
      "name": "invalidAttempt",
      "msg": "Invalid attempt number"
    },
    {
      "code": 6025,
      "name": "slotHashesUnavailable",
      "msg": "SlotHashes sysvar data is unavailable"
    },
    {
      "code": 6026,
      "name": "dayNotOver",
      "msg": "Day has not ended yet"
    },
    {
      "code": 6027,
      "name": "dayWasPassed",
      "msg": "Participant passed that day"
    },
    {
      "code": 6028,
      "name": "notEnded",
      "msg": "Challenge has not ended yet"
    },
    {
      "code": 6029,
      "name": "participantsMismatch",
      "msg": "All participants must be passed to settle"
    },
    {
      "code": 6030,
      "name": "duplicateParticipant",
      "msg": "Duplicate participant account"
    },
    {
      "code": 6031,
      "name": "notSurvivor",
      "msg": "Participant did not survive"
    },
    {
      "code": 6032,
      "name": "invalidBonus",
      "msg": "Invalid bonus settings"
    },
    {
      "code": 6033,
      "name": "overflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "challenge",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "judge",
            "type": "pubkey"
          },
          {
            "name": "mode",
            "type": "u8"
          },
          {
            "name": "demo",
            "type": "bool"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          },
          {
            "name": "startTs",
            "docs": [
              "Reference start. Real challenges: 00:00 UTC of the start date; each member starts",
              "at their own local midnight (start_ts - utc_offset). Demo: everyone starts here."
            ],
            "type": "i64"
          },
          {
            "name": "dayLen",
            "type": "i64"
          },
          {
            "name": "numDays",
            "type": "u16"
          },
          {
            "name": "graceSecs",
            "docs": [
              "Time after a day ends during which the judge may still record that day."
            ],
            "type": "i64"
          },
          {
            "name": "windowSecs",
            "type": "u32"
          },
          {
            "name": "maxPlayers",
            "type": "u8"
          },
          {
            "name": "playerCount",
            "type": "u8"
          },
          {
            "name": "activeCount",
            "type": "u8"
          },
          {
            "name": "survivorCount",
            "type": "u8"
          },
          {
            "name": "claimedCount",
            "type": "u8"
          },
          {
            "name": "configHash",
            "docs": [
              "SHA-256 of the offchain proof plan (rules the AI judges against)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "failDest",
            "type": "u8"
          },
          {
            "name": "charity",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "lastEndTs",
            "docs": [
              "Latest end time across all members (members in different time zones end at different times)."
            ],
            "type": "i64"
          },
          {
            "name": "potLamports",
            "type": "u64"
          },
          {
            "name": "shareLamports",
            "type": "u64"
          },
          {
            "name": "bonusLamports",
            "type": "u64"
          },
          {
            "name": "settledAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "checkIn",
      "docs": [
        "Permanent record of one judged proof (or a day-0 baseline)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challenge",
            "type": "pubkey"
          },
          {
            "name": "participant",
            "type": "pubkey"
          },
          {
            "name": "day",
            "type": "u16"
          },
          {
            "name": "attempt",
            "type": "u8"
          },
          {
            "name": "verdict",
            "type": "u8"
          },
          {
            "name": "reasonCode",
            "type": "u16"
          },
          {
            "name": "proofHash",
            "docs": [
              "SHA-256 of the proof bundle. Photos themselves never go onchain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metricA",
            "docs": [
              "Proof-type specific numbers, e.g. Duolingo total XP / streak, gym minutes."
            ],
            "type": "u64"
          },
          {
            "name": "metricB",
            "type": "u64"
          },
          {
            "name": "window",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "checkInArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "day",
            "type": "u16"
          },
          {
            "name": "attempt",
            "type": "u8"
          },
          {
            "name": "verdict",
            "type": "u8"
          },
          {
            "name": "reasonCode",
            "type": "u16"
          },
          {
            "name": "proofHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metricA",
            "type": "u64"
          },
          {
            "name": "metricB",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "communityPool",
      "docs": [
        "Program-owned community pool. Its lamports are the pool balance (minus rent)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalIn",
            "type": "u64"
          },
          {
            "name": "totalOut",
            "type": "u64"
          },
          {
            "name": "bonusesPaid",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Global settings. The admin sets which key is the AI judge and which demo charity",
        "wallets solo users may pick."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "judge",
            "type": "pubkey"
          },
          {
            "name": "charities",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "bonusBps",
            "docs": [
              "Bonus paid to each solo finisher, in basis points of the pool balance."
            ],
            "type": "u16"
          },
          {
            "name": "bonusCap",
            "docs": [
              "Upper bound on a single solo bonus."
            ],
            "type": "u64"
          },
          {
            "name": "challengeCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "judge",
            "type": "pubkey"
          },
          {
            "name": "charities",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "bonusBps",
            "type": "u16"
          },
          {
            "name": "bonusCap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createChallengeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "mode",
            "type": "u8"
          },
          {
            "name": "demo",
            "type": "bool"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "dayLen",
            "type": "i64"
          },
          {
            "name": "numDays",
            "type": "u16"
          },
          {
            "name": "graceSecs",
            "type": "i64"
          },
          {
            "name": "windowSecs",
            "type": "u32"
          },
          {
            "name": "maxPlayers",
            "type": "u8"
          },
          {
            "name": "configHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "failDest",
            "type": "u8"
          },
          {
            "name": "charityIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "participant",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challenge",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "startTs",
            "docs": [
              "This member's own day-1 start (their local midnight), Unix seconds."
            ],
            "type": "i64"
          },
          {
            "name": "utcOffsetMin",
            "type": "i16"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "eliminatedDay",
            "type": "u16"
          },
          {
            "name": "eliminatedReason",
            "type": "u8"
          },
          {
            "name": "passedBitmap",
            "docs": [
              "Bit (d-1) is set once day d has a passing check-in."
            ],
            "type": "u64"
          },
          {
            "name": "daysPassed",
            "type": "u16"
          },
          {
            "name": "lastCheckinDay",
            "type": "u16"
          },
          {
            "name": "checkins",
            "type": "u16"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "Holds the stakes for one challenge. Program-owned so only this program can debit it."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challenge",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "window",
      "docs": [
        "A proof window for one member on one day. The pose (and any random pages) are",
        "derived from `slot_hash`, read from the SlotHashes sysvar when the window opened."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challenge",
            "type": "pubkey"
          },
          {
            "name": "participant",
            "type": "pubkey"
          },
          {
            "name": "day",
            "type": "u16"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "slotHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "openedAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "pose",
            "docs": [
              "[fingers 1-5, direction 0-3, extra 0-3]"
            ],
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
