use std::cmp::Ordering;
use std::collections::BinaryHeap;

use crate::coding::VarInt;
use crate::model::{GroupOrder, TrackAlias};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryType {
    Subgroup { subgroup_id: VarInt },
    Datagram { object_id: VarInt },
}

#[derive(Debug, Clone)]
pub struct SchedulableMeta {
    pub subscription_id: VarInt,
    pub track_alias: TrackAlias,
    pub group_id: VarInt,
    pub subscriber_priority: u8,
    pub publisher_priority: u8,
    pub group_order: GroupOrder,
    pub delivery: DeliveryType,
}

#[derive(Debug, Clone)]
pub struct QueueItem<T> {
    pub meta: SchedulableMeta,
    pub payload: T,
}

impl<T> QueueItem<T> {
    fn cmp_priority(&self, other: &Self) -> Ordering {
        use Ordering::*;
        // 1. subscriber priority (lower value is higher priority)
        match self
            .meta
            .subscriber_priority
            .cmp(&other.meta.subscriber_priority)
        {
            Less => return Greater,
            Greater => return Less,
            Equal => {}
        }
        // 2. publisher priority
        match self
            .meta
            .publisher_priority
            .cmp(&other.meta.publisher_priority)
        {
            Less => return Greater,
            Greater => return Less,
            Equal => {}
        }
        // 3. group order within same track and different group
        if self.meta.track_alias == other.meta.track_alias
            && self.meta.group_id != other.meta.group_id
            && self.meta.group_order == other.meta.group_order
        {
            match self.meta.group_order {
                GroupOrder::Ascending => {
                    return other.meta.group_id.cmp(&self.meta.group_id);
                }
                GroupOrder::Descending => {
                    return self.meta.group_id.cmp(&other.meta.group_id);
                }
                GroupOrder::Publisher => {}
            }
        }
        // 4. same group of same track
        if self.meta.track_alias == other.meta.track_alias
            && self.meta.group_id == other.meta.group_id
        {
            match (&self.meta.delivery, &other.meta.delivery) {
                (
                    DeliveryType::Subgroup { subgroup_id: a },
                    DeliveryType::Subgroup { subgroup_id: b },
                ) => {
                    return b.cmp(a);
                }
                (
                    DeliveryType::Datagram { object_id: a },
                    DeliveryType::Datagram { object_id: b },
                ) => {
                    return b.cmp(a);
                }
                _ => {}
            }
        }
        Equal
    }
}

impl<T> Ord for QueueItem<T> {
    fn cmp(&self, other: &Self) -> Ordering {
        self.cmp_priority(other)
    }
}

impl<T> PartialOrd for QueueItem<T> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<T> PartialEq for QueueItem<T> {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl<T> Eq for QueueItem<T> {}

pub struct PriorityScheduler<T> {
    heap: BinaryHeap<QueueItem<T>>,
}

impl<T> PriorityScheduler<T> {
    pub fn new() -> Self {
        Self {
            heap: BinaryHeap::new(),
        }
    }

    pub fn push(&mut self, item: QueueItem<T>) {
        self.heap.push(item);
    }

    pub fn pop(&mut self) -> Option<QueueItem<T>> {
        self.heap.pop()
    }

    pub fn is_empty(&self) -> bool {
        self.heap.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::GroupOrder;

    #[test]
    fn subscriber_priority_ordering() {
        let mut sched: PriorityScheduler<()> = PriorityScheduler::new();
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(0),
                subscriber_priority: 10,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(0),
                },
            },
            payload: (),
        });
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(2),
                track_alias: VarInt(0),
                group_id: VarInt(0),
                subscriber_priority: 5,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(1),
                },
            },
            payload: (),
        });
        let first = sched.pop().unwrap();
        assert_eq!(first.meta.subscription_id, VarInt(2));
    }

    #[test]
    fn publisher_priority_ordering() {
        let mut sched: PriorityScheduler<()> = PriorityScheduler::new();
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(0),
                subscriber_priority: 5,
                publisher_priority: 10,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(0),
                },
            },
            payload: (),
        });
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(2),
                track_alias: VarInt(0),
                group_id: VarInt(0),
                subscriber_priority: 5,
                publisher_priority: 1,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(1),
                },
            },
            payload: (),
        });
        let first = sched.pop().unwrap();
        assert_eq!(first.meta.subscription_id, VarInt(2));
    }

    #[test]
    fn group_order_ascending() {
        let mut sched: PriorityScheduler<()> = PriorityScheduler::new();
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(2),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(0),
                },
            },
            payload: (),
        });
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(1),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(1),
                },
            },
            payload: (),
        });
        let first = sched.pop().unwrap();
        assert_eq!(first.meta.group_id, VarInt(1));
    }

    #[test]
    fn group_order_descending() {
        let mut sched: PriorityScheduler<()> = PriorityScheduler::new();
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(1),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Descending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(1),
                },
            },
            payload: (),
        });
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(2),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Descending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(2),
                },
            },
            payload: (),
        });
        let first = sched.pop().unwrap();
        assert_eq!(first.meta.group_id, VarInt(2));
    }

    #[test]
    fn same_group_object_order() {
        let mut sched: PriorityScheduler<()> = PriorityScheduler::new();
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(1),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(2),
                },
            },
            payload: (),
        });
        sched.push(QueueItem {
            meta: SchedulableMeta {
                subscription_id: VarInt(1),
                track_alias: VarInt(0),
                group_id: VarInt(1),
                subscriber_priority: 0,
                publisher_priority: 0,
                group_order: GroupOrder::Ascending,
                delivery: DeliveryType::Datagram {
                    object_id: VarInt(1),
                },
            },
            payload: (),
        });
        let first = sched.pop().unwrap();
        assert_eq!(
            first.meta.delivery,
            DeliveryType::Datagram {
                object_id: VarInt(1)
            }
        );
    }
}
